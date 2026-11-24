import "server-only";
import { GoogleGenAI } from "@google/genai";
import { type z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env } from "~/env";

/** Main key first, then GEMINI_BACKUP_API_KEYS in order (duplicates removed). */
const KEYS = [env.GEMINI_API_KEY, ...(env.GEMINI_BACKUP_API_KEYS ?? "").split(",")]
  .map((k) => k.trim())
  .filter((k, i, all) => !!k && all.indexOf(k) === i);

const clients = new Map<number, GoogleGenAI>();
function getClient(keyIndex: number) {
  let c = clients.get(keyIndex);
  if (!c) {
    c = new GoogleGenAI({
      apiKey: KEYS[keyIndex],
      // Fail fast: the SDK otherwise retries 5x with backoff, which can stall a request for minutes
      // when the model is overloaded. Our own chain (next key -> next model -> Groq) handles retries.
      httpOptions: { timeout: 25_000, retryOptions: { attempts: 1 } },
    });
    clients.set(keyIndex, c);
  }
  return c;
}

/**
 * Keys that recently failed, per model ("<key>|<model>" -> retry after). Quota is per project and
 * model, so a key out of quota for one model may still work for another. A rejected key (invalid /
 * revoked) is skipped for every model.
 */
const coolingUntil = new Map<string, number>();
const QUOTA_COOLDOWN_MS = 5 * 60_000;
const BAD_KEY_COOLDOWN_MS = 60 * 60_000;
const coolKey = (k: number, model: string) => `${k}|${model}`;
function keyOrder(model: string): number[] {
  const now = Date.now();
  const ready = KEYS.map((_, i) => i).filter(
    (i) => (coolingUntil.get(coolKey(i, model)) ?? 0) <= now && (coolingUntil.get(coolKey(i, "*")) ?? 0) <= now,
  );
  // If every key is cooling down, still try them all rather than fail without asking.
  return ready.length > 0 ? ready : KEYS.map((_, i) => i);
}

export interface InlineFile {
  /** base64 without the data: prefix */
  data: string;
  mimeType: string;
}

/**
 * One Gemini call that returns JSON validated against a zod schema.
 * Supports text plus inline audio/image parts (inline limit is ~20 MB per request).
 */
export async function geminiJson<T extends z.ZodTypeAny>(opts: {
  prompt: string;
  schema: T;
  files?: InlineFile[];
  temperature?: number;
}): Promise<z.infer<T>> {
  const jsonSchema = zodToJsonSchema(opts.schema, { $refStrategy: "none" });
  delete (jsonSchema as Record<string, unknown>).$schema;

  // GEMINI_FALLBACK_MODEL may be a comma-separated list, tried in order.
  const models = [
    env.GEMINI_MODEL,
    ...(env.GEMINI_FALLBACK_MODEL ?? "").split(",").map((m) => m.trim()),
  ].filter((m, i, all): m is string => !!m && all.indexOf(m) === i);
  let lastErr: unknown;
  for (const model of models) {
    keys: for (const k of keyOrder(model)) {
      // "High demand" 503 spikes on the free tier usually clear within a second, so give each
      // model one quick retry. Quota (429) moves to the next key; overload moves to the next model.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await callModel(model, k, opts, jsonSchema);
        } catch (err) {
          lastErr = err;
          const msg = String((err as Error)?.message ?? err);
          // A model ID that does not exist (or was retired) should not sink the request.
          if (/404|NOT_FOUND|is not found/i.test(msg)) {
            console.warn(`[gemini] ${model} not found, skipping (check GEMINI_*_MODEL)`);
            break keys;
          }
          if (isBadKey(err)) {
            console.warn(`[gemini] key #${k + 1} rejected (invalid / revoked), trying next key`);
            coolingUntil.set(coolKey(k, "*"), Date.now() + BAD_KEY_COOLDOWN_MS);
            continue keys;
          }
          if (isQuota(err)) {
            console.warn(`[gemini] key #${k + 1} out of quota for ${model}, trying next key`);
            coolingUntil.set(coolKey(k, model), Date.now() + QUOTA_COOLDOWN_MS);
            continue keys;
          }
          if (!isRetryable(err)) throw err;
          if (attempt === 1 && /503|UNAVAILABLE|high demand/i.test(msg)) {
            console.warn(`[gemini] ${model} overloaded, retrying once`);
            await new Promise((r) => setTimeout(r, 900));
            continue;
          }
          // Overload / timeout affects the model for every key: try the next model.
          console.warn(`[gemini] ${model} unavailable, trying next model`);
          break keys;
        }
      }
    }
  }
  throw lastErr;
}

const errText = (err: unknown) =>
  err instanceof Error ? `${err.name} ${err.message}` : String(err);

function isQuota(err: unknown): boolean {
  return (err as { status?: number })?.status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(errText(err));
}

function isBadKey(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return (
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|API key not valid|API key expired|PERMISSION_DENIED|UNAUTHENTICATED/i.test(errText(err))
  );
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 500 || status === 503 || status === 504)
    return true;
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /"code":\s*(429|500|503|504)|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE|high demand|timeout|timed out|abort/i.test(
    msg,
  );
}

async function callModel<T extends z.ZodTypeAny>(
  model: string,
  keyIndex: number,
  opts: {
    prompt: string;
    schema: T;
    files?: InlineFile[];
    temperature?: number;
  },
  jsonSchema: unknown,
): Promise<z.infer<T>> {
  const res = await getClient(keyIndex).models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          ...(opts.files ?? []).map((f) => ({
            inlineData: { data: f.data, mimeType: f.mimeType },
          })),
          { text: opts.prompt },
        ],
      },
    ],
    config: {
      temperature: opts.temperature ?? 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return opts.schema.parse(JSON.parse(text)) as z.infer<T>;
}
