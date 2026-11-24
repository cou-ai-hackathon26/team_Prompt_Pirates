/**
 * End-to-end AI validation against the running app (pnpm dev).
 *
 *   node scripts/validate-ai.mjs [baseUrl]        default http://localhost:3000
 *
 * 1. CBC reader: every sample report (clean scan + phone-photo look) vs the expected values.
 * 2. Text understanding: Bangla phrases (incl. dialect / code-mixing) vs expected symptoms.
 * 3. Voice: Bangla speech clips (generated once with Gemini TTS, cached in scripts/validation/audio)
 *    sent through the same voice endpoint the app uses.
 * Writes a report to docs/VALIDATION_REPORT.md.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));

async function trpc(path, input) {
  const t = Date.now();
  const res = await fetch(`${BASE}/api/trpc/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
  const body = await res.json().catch(() => ({}));
  const ms = Date.now() - t;
  if (!res.ok) return { ok: false, ms, error: body.error?.json?.message ?? `HTTP ${res.status}` };
  return { ok: true, ms, data: body.result.data.json };
}

const results = [];
const record = (group, name, pass, detail, ms) => {
  results.push({ group, name, pass, detail, ms });
  console.log(`${pass ? "✓" : "✗"} [${group}] ${name} ${ms ? `(${(ms / 1000).toFixed(1)}s)` : ""}${pass ? "" : `\n    ${detail}`}`);
};

/* ---------------------------- 1. CBC reports ---------------------------- */
const samples = JSON.parse(readFileSync("public/samples/cbc/index.json", "utf8"));
for (const s of samples) {
  for (const variant of ["", "-photo"]) {
    const img = readFileSync(`public/samples/cbc/${s.id}${variant}.png`).toString("base64");
    const r = await trpc("cbc.extract", { imageBase64: img, mimeType: "image/png" });
    const name = `${s.id}${variant || " (clean)"}`;
    if (!r.ok) { record("CBC", name, false, r.error, r.ms); continue; }
    if (s.expected.isCbcReport === false) {
      record("CBC", name, r.data.raw.isCbcReport === false, `isCbcReport=${r.data.raw.isCbcReport}`, r.ms);
      continue;
    }
    const v = r.data.values;
    const diffs = Object.entries(s.expected).filter(([k, want]) => {
      const got = v[k];
      return got == null || Math.abs(got - want) / want > 0.01;
    }).map(([k, want]) => `${k}: want ${want}, got ${v[k]}`);
    record("CBC", name, diffs.length === 0, `${diffs.join("; ")} | raw platelet "${r.data.raw.plateletRaw}" ${r.data.raw.plateletUnit ?? ""} | provider ${r.data.provider}`, r.ms);
  }
}

/* --------------------------- 2. Bangla text ----------------------------- */
const PHRASES = [
  ["জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে", { feverJustDropped: true, abdominalPain: "severe", vomitingCount24h: 2 }],
  ["জ্বর ১০২, পানি খাচ্ছে, বমি নেই, পেটে ব্যথা নেই", { temperatureF: 102, canDrinkFluids: true, vomitingCount24h: 0, abdominalPain: "none" }],
  ["সকাল থেকে প্রস্রাব হয়নি, খুব ঝিমাচ্ছে, দাঁত দিয়ে রক্ত পড়ছে", { noUrine6h: true, drowsyOrRestless: true, bleedingGums: true }],
  ["বাচ্চা কিছুই খাইতে পারতেছে না, যা খায় বমি কইরা ফালায়, চাইরবার বমি হইছে", { canDrinkFluids: false, vomitingCount24h: 4 }],
  ["Fever ta kome geche, but platelet nemese, hat-pa thanda hoye ache", { feverJustDropped: true, coldClammyHands: true }],
  ["নাক দিয়া রক্ত পড়ছে, পায়খানা কালা কালা", { bleedingNose: true, blackStool: true }],
  ["আজকে অনেক ভালো, জ্বর নাই, স্বাভাবিক খাওয়া দাওয়া করতেছে", { fever: false }],
];
for (const [text, want] of PHRASES) {
  const r = await trpc("checkin.extractText", { transcript: text });
  if (!r.ok) { record("Text", text, false, r.error, r.ms); continue; }
  const got = r.data.value.symptoms;
  const diffs = Object.entries(want).filter(([k, w]) => got[k] !== w).map(([k, w]) => `${k}: want ${w}, got ${got[k]}`);
  record("Text", text, diffs.length === 0, diffs.join("; "), r.ms);
}

/* ------------------------------ 3. Voice -------------------------------- */
const AUDIO_DIR = "scripts/validation/audio";
mkdirSync(AUDIO_DIR, { recursive: true });
const wav = (pcm, rate) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
async function ttsClip(i, text, voice) {
  const file = `${AUDIO_DIR}/clip-${i}.wav`;
  if (existsSync(file)) return readFileSync(file);
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
  });
  const j = await res.json();
  const p = j.candidates?.[0]?.content?.parts?.find((x) => x.inlineData);
  if (!p) throw new Error(j.error?.message ?? "no audio");
  // downsample 24 kHz -> 16 kHz like the browser does (simple linear interpolation)
  const src = Buffer.from(p.inlineData.data, "base64");
  const inRate = Number(/rate=(\d+)/.exec(p.inlineData.mimeType)?.[1] ?? 24000);
  const n = Math.floor(((src.length / 2) * 16000) / inRate);
  const out = Buffer.alloc(n * 2);
  for (let k = 0; k < n; k++) out.writeInt16LE(src.readInt16LE(Math.min(src.length / 2 - 1, Math.floor((k * inRate) / 16000)) * 2), k * 2);
  const buf = wav(out, 16000);
  writeFileSync(file, buf);
  return buf;
}
const VOICES = ["Kore", "Puck", "Charon"];
for (const [i, [text, want]] of PHRASES.slice(0, 4).entries()) {
  let audio;
  try { audio = await ttsClip(i, text, VOICES[i % VOICES.length]); } catch (e) { record("Voice (TTS)", text, false, `TTS failed: ${e.message}`); continue; }
  const r = await trpc("checkin.extractVoice", { audioBase64: audio.toString("base64"), mimeType: "audio/wav" });
  if (!r.ok) { record("Voice (TTS)", text, false, r.error, r.ms); continue; }
  const got = r.data.value.symptoms;
  const diffs = Object.entries(want).filter(([k, w]) => got[k] !== w).map(([k, w]) => `${k}: want ${w}, got ${got[k]}`);
  record("Voice (TTS)", text, diffs.length === 0, `${diffs.join("; ")} | heard: "${r.data.value.transcriptBn}"`, r.ms);
}

/* --------------------- 3b. Real human recordings ------------------------ */
// Put your own recordings in scripts/validation/audio/human/<name>.wav (16 kHz mono WAV is best; any WAV works)
// with <name>.json holding the expected symptoms, e.g. { "abdominalPain": "severe", "vomitingCount24h": 2 }
const HUMAN = `${AUDIO_DIR}/human`;
if (existsSync(HUMAN)) {
  for (const f of readdirSync(HUMAN).filter((x) => x.endsWith(".wav"))) {
    const wantFile = `${HUMAN}/${f.replace(/\.wav$/, ".json")}`;
    if (!existsSync(wantFile)) { console.warn(`skip ${f}: no matching .json`); continue; }
    const want = JSON.parse(readFileSync(wantFile, "utf8"));
    const r = await trpc("checkin.extractVoice", { audioBase64: readFileSync(`${HUMAN}/${f}`).toString("base64"), mimeType: "audio/wav" });
    if (!r.ok) { record("Voice (human)", f, false, r.error, r.ms); continue; }
    const got = r.data.value.symptoms;
    const diffs = Object.entries(want).filter(([k, w]) => got[k] !== w).map(([k, w]) => `${k}: want ${w}, got ${got[k]}`);
    record("Voice (human)", f, diffs.length === 0, `${diffs.join("; ")} | heard: "${r.data.value.transcriptBn}"`, r.ms);
  }
}

/* ------------------------------ report ---------------------------------- */
const groups = [...new Set(results.map((r) => r.group))];
const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length / 1000).toFixed(1) : "-");
let md = `# AI validation report\n\nRun: ${new Date().toISOString()} against ${BASE}\nModels: primary ${env.GEMINI_MODEL}, fallback ${env.GEMINI_FALLBACK_MODEL}, Groq ${env.GROQ_TEXT_MODEL} / ${env.GROQ_VISION_MODEL}\n\n| Area | Passed | Avg time |\n|---|---|---|\n`;
for (const g of groups) { const rs = results.filter((r) => r.group === g); md += `| ${g} | ${rs.filter((r) => r.pass).length}/${rs.length} | ${avg(rs.filter((r) => r.ms).map((r) => r.ms))} s |\n`; }
md += `\nResponses are cached by input, so a repeat run is instant; delete AiCache rows to re-test the live model.\n\n| Area | Case | Result | Detail |\n|---|---|---|---|\n`;
for (const r of results) md += `| ${r.group} | ${r.name} | ${r.pass ? "pass" : "**FAIL**"} | ${r.pass ? "" : String(r.detail).replace(/\|/g, "/")} |\n`;
writeFileSync("docs/VALIDATION_REPORT.md", md);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed. Report: docs/VALIDATION_REPORT.md`);
