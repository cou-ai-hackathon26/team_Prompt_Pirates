import "server-only";
import Groq, { toFile } from "groq-sdk";
import { type z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env } from "~/env";

let client: Groq | null = null;
function getClient() {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
  client ??= new Groq({ apiKey: env.GROQ_API_KEY, timeout: 25_000, maxRetries: 1 });
  return client;
}

export const groqAvailable = () => !!env.GROQ_API_KEY;

/** Whisper speech-to-text (Bangla). Accepts webm/wav/mp3/m4a/ogg. */
export async function groqTranscribe(audio: Buffer, filename: string): Promise<string> {
  const res = await getClient().audio.transcriptions.create({
    file: await toFile(audio, filename),
    model: env.GROQ_STT_MODEL,
    language: "bn",
    response_format: "json",
  });
  return res.text;
}

/** Chat completion in JSON mode, optionally with one image (vision model). */
export async function groqJson<T extends z.ZodTypeAny>(opts: {
  prompt: string;
  schema: T;
  imageDataUrl?: string;
}): Promise<z.infer<T>> {
  const schemaText = JSON.stringify(zodToJsonSchema(opts.schema, { $refStrategy: "none" }));
  const text = `${opts.prompt}\n\nThe JSON must match this JSON Schema:\n${schemaText}`;

  const res = await getClient().chat.completions.create({
    model: opts.imageDataUrl ? env.GROQ_VISION_MODEL : env.GROQ_TEXT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: opts.imageDataUrl
          ? [
              { type: "text", text },
              { type: "image_url", image_url: { url: opts.imageDataUrl } },
            ]
          : text,
      },
    ],
  });
  const out = res.choices[0]?.message?.content;
  if (!out) throw new Error("Groq returned an empty response");
  return opts.schema.parse(JSON.parse(out)) as z.infer<T>;
}
