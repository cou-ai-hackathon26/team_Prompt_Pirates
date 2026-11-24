import "server-only";
import { cached } from "./cache";
import { geminiJson } from "./gemini";
import { groqAvailable, groqJson, groqTranscribe } from "./groq";
import {
  CBC_EXTRACTION_PROMPT,
  RISK_REVIEW_PROMPT,
  VOICE_EXTRACTION_PROMPT,
  VOICE_TEXT_EXTRACTION_PROMPT,
} from "./prompts";
import {
  aiRiskSchema,
  cbcExtractionSchema,
  voiceExtractionSchema,
  type AiRisk,
  type CbcExtraction,
  type VoiceExtraction,
} from "./schemas";

export type AiProvider = "gemini" | "groq" | "cache";

/** Start the Groq backup if Gemini has not answered within this time. */
const HEDGE_AFTER_MS = 12_000;

/**
 * Hedged request: start Gemini; if it fails OR is still running after HEDGE_AFTER_MS,
 * also start Groq, and return whichever succeeds first. Free-tier Gemini latency is very
 * uneven (1 s to 90 s for the same image), so waiting for a timeout before falling back
 * made the worst case ~70 s. This caps it at roughly HEDGE_AFTER_MS + Groq time.
 */
async function withFallback<T>(
  label: string,
  primary: () => Promise<T>,
  fallback: (() => Promise<T>) | null,
): Promise<{ value: T; provider: AiProvider }> {
  const canFallback = !!fallback && groqAvailable();
  return new Promise((resolve, reject) => {
    let settled = false;
    let pending = 1;
    let backupStarted = false;
    let lastErr: unknown;

    const win = (value: T, provider: AiProvider) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ value, provider });
    };
    const lose = (err: unknown, who: string) => {
      lastErr = err;
      console.warn(
        `[ai:${label}] ${who} failed:`,
        err instanceof Error ? err.message : err,
      );
      pending--;
      if (who === "Gemini") startBackup();
      if (pending === 0 && !settled) {
        settled = true;
        reject(lastErr instanceof Error ? lastErr : new Error(String(lastErr)));
      }
    };
    const startBackup = () => {
      if (backupStarted || settled || !canFallback || !fallback) return;
      backupStarted = true;
      pending++;
      fallback().then(
        (v) => win(v, "groq"),
        (e) => lose(e, "Groq"),
      );
    };

    const timer = setTimeout(() => {
      if (!settled && canFallback)
        console.warn(
          `[ai:${label}] Gemini slow (>${HEDGE_AFTER_MS / 1000}s), starting Groq in parallel`,
        );
      startBackup();
    }, HEDGE_AFTER_MS);
    primary().then(
      (v) => win(v, "gemini"),
      (e) => lose(e, "Gemini"),
    );
  });
}

/** Bangla voice clip (16 kHz MP3 from the app; WAV also accepted) -> transcript + structured symptoms. */
export async function extractVoice(audioBase64: string, mimeType: string) {
  return cached(["voice-v4", audioBase64], () =>
    withFallback<VoiceExtraction>(
      "voice",
      () =>
        geminiJson({
          prompt: VOICE_EXTRACTION_PROMPT,
          schema: voiceExtractionSchema,
          files: [{ data: audioBase64, mimeType }],
        }),
      async () => {
        const ext = mimeType.includes("wav")
          ? "wav"
          : mimeType.includes("mpeg") || mimeType.includes("mp3")
            ? "mp3"
            : mimeType.includes("mp4")
            ? "m4a"
            : "webm";
        const transcript = await groqTranscribe(
          Buffer.from(audioBase64, "base64"),
          `audio.${ext}`,
        );
        return groqJson({
          prompt: VOICE_TEXT_EXTRACTION_PROMPT(transcript),
          schema: voiceExtractionSchema,
        });
      },
    ),
  );
}

/** Typed text (e.g. from browser Web Speech API) -> structured symptoms. */
export async function extractFromTranscript(transcript: string) {
  const prompt = VOICE_TEXT_EXTRACTION_PROMPT(transcript);
  return cached(["text-v4", transcript], () =>
    withFallback<VoiceExtraction>(
      "text",
      () => geminiJson({ prompt, schema: voiceExtractionSchema }),
      () => groqJson({ prompt, schema: voiceExtractionSchema }),
    ),
  );
}

/** CBC report photo (JPEG, already compressed client-side) -> raw values. */
export async function extractCbc(imageBase64: string, mimeType: string) {
  return cached(["cbc-v2", imageBase64], () =>
    withFallback<CbcExtraction>(
      "cbc",
      () =>
        geminiJson({
          prompt: CBC_EXTRACTION_PROMPT,
          schema: cbcExtractionSchema,
          files: [{ data: imageBase64, mimeType }],
        }),
      // Groq vision models only take images, not PDFs: no backup for PDF reports.
      mimeType === "application/pdf"
        ? null
        : () =>
            groqJson({
              prompt: CBC_EXTRACTION_PROMPT,
              schema: cbcExtractionSchema,
              imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
            }),
    ),
  );
}

/** AI second opinion on the whole timeline. Caller must enforce "AI can only raise". */
export async function reviewRisk(timeline: unknown, ruleResult: unknown) {
  const prompt = RISK_REVIEW_PROMPT(
    JSON.stringify(timeline),
    JSON.stringify(ruleResult),
  );
  return cached(["risk-v1", prompt], () =>
    withFallback<AiRisk>(
      "risk",
      () => geminiJson({ prompt, schema: aiRiskSchema, temperature: 0.2 }),
      () => groqJson({ prompt, schema: aiRiskSchema }),
    ),
  );
}
