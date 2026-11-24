import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Google AI Studio key (free tier). Primary model for voice, vision and text.
    GEMINI_API_KEY: z.string().min(1),
    // Optional comma-separated backup keys (each from a separate Google Cloud project), tried in
    // order when a key hits its quota (429) or is invalid / revoked.
    GEMINI_BACKUP_API_KEYS: z.string().optional(),
    // Model IDs change often; list what your key can use with GET /v1beta/models.
    GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
    // Tried in order when the primary model is overloaded (503), rate limited (429) or not found.
    // Comma-separated list. Use exact model IDs; "-latest" aliases are not supported by the SDK.
    GEMINI_FALLBACK_MODEL: z.string().optional(),
    // Groq key (free tier). Optional fallback when Gemini fails or is rate limited.
    GROQ_API_KEY: z.string().optional(),
    GROQ_STT_MODEL: z.string().default("whisper-large-v3"),
    GROQ_TEXT_MODEL: z.string().default("openai/gpt-oss-120b"),
    GROQ_VISION_MODEL: z.string().default("qwen/qwen3.8-27b"),
    // Staff login (Auth.js + Google) protecting /dashboard. Optional so the patient app still
    // builds without them; the dashboard then explains that login is not configured.
    AUTH_SECRET: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    // Comma-separated emails allowed on the dashboard (families can also sign in, so this is the
    // only way to be staff). Empty = nobody.
    STAFF_EMAILS: z.string().optional(),
  },

  client: {},

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_BACKUP_API_KEYS: process.env.GEMINI_BACKUP_API_KEYS,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_STT_MODEL: process.env.GROQ_STT_MODEL,
    GROQ_TEXT_MODEL: process.env.GROQ_TEXT_MODEL,
    GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    STAFF_EMAILS: process.env.STAFF_EMAILS,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
