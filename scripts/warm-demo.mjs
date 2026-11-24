/**
 * Pre-warm the AI cache with the exact inputs used in the stage demo, so they answer instantly
 * even when the free AI tier is slow or overloaded.
 *
 *   node scripts/warm-demo.mjs                         # against http://localhost:3000
 *   node scripts/warm-demo.mjs https://your-app.vercel.app
 *
 * Works because AI answers are cached by input (AiCache table) and the app sends sample reports
 * byte-for-byte. A live voice recording is never identical, so it is never pre-cached: for the
 * guaranteed-fast path, use "লিখে জানান" (typed text) with the example sentence.
 * Run it after `pnpm db:seed` / `pnpm demo:reset` (they don't clear the cache) and again if you
 * change prompts (prompt changes bump the cache version).
 */
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// Must match EXAMPLES in src/app/p/[id]/checkin/checkin-flow.tsx
const SENTENCES = [
  "জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে",
  "জ্বর ১০২, পানি খাচ্ছে, বমি নেই, পেটে ব্যথা নেই",
  "সকালে জ্বর ১০৩ ছিল, দুইবার বমি করছে। দুপুরে দাঁত দিয়ে একটু রক্ত পড়ছিল, এখন বন্ধ। বিকেল থেকে জ্বর নেই, পানি খাচ্ছে।",
  "সকাল থেকে প্রস্রাব হয়নি, খুব ঝিমাচ্ছে, দাঁত দিয়ে রক্ত পড়ছে",
];
// The sample picker sends the "-photo" version of each report
const SAMPLES = JSON.parse(
  readFileSync("public/samples/cbc/index.json", "utf8"),
).map((s) => s.id);

async function call(path, input, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const t = Date.now();
    const res = await fetch(`${BASE}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    }).catch((e) => ({ ok: false, status: e.message, json: async () => ({}) }));
    const ms = Date.now() - t;
    if (res.ok) return { ok: true, ms };
    const body = await res.json().catch(() => ({}));
    console.log(
      `  retry ${i}/${attempts} (${res.status}) ${body.error?.json?.message ?? ""}`,
    );
  }
  return { ok: false };
}

let ok = 0;
let total = 0;
for (const s of SENTENCES) {
  total++;
  const r = await call("checkin.extractText", { transcript: s });
  if (r.ok) ok++;
  console.log(
    `${r.ok ? "✓" : "✗"} text  ${s.slice(0, 40)}… ${r.ok ? `(${(r.ms / 1000).toFixed(1)}s${r.ms < 1500 ? ", already cached" : ""})` : ""}`,
  );
}
for (const id of SAMPLES) {
  total++;
  const imageBase64 = readFileSync(
    `public/samples/cbc/${id}-photo.png`,
  ).toString("base64");
  const r = await call("cbc.extract", { imageBase64, mimeType: "image/png" });
  if (r.ok) ok++;
  console.log(
    `${r.ok ? "✓" : "✗"} cbc   ${id} ${r.ok ? `(${(r.ms / 1000).toFixed(1)}s${r.ms < 1500 ? ", already cached" : ""})` : ""}`,
  );
}
console.log(
  `\n${ok}/${total} demo inputs cached at ${BASE}. Run again: everything should answer in under ~1.5 s.`,
);
