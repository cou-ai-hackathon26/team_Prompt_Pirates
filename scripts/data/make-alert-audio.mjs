/**
 * Pre-generates the spoken Bangla status alerts with Gemini TTS (free tier), saved as WAV.
 *   node scripts/data/make-alert-audio.mjs
 * The app plays /audio/<status>.wav; if a file is missing it falls back to the browser's voice.
 */
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const MODELS = ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
const TEXTS = {
  green: "সবুজ সংকেত। রোগী এখন বাসায় থাকতে পারে। প্রচুর পানি, ওরস্যালাইন আর তরল খাবার খাওয়ান। জ্বরের জন্য শুধু প্যারাসিটামল দিন।",
  yellow: "হলুদ সংকেত। আজই একজন ডাক্তার দেখান এবং রক্ত পরীক্ষা করান। পেটে তীব্র ব্যথা, বারবার বমি বা রক্তপাত হলে সাথে সাথে হাসপাতালে যান।",
  red: "লাল সংকেত। এখনই রোগীকে নিকটস্থ হাসপাতালে নিয়ে যান। দেরি করবেন না। পথে অল্প অল্প করে পানি বা ওরস্যালাইন খাওয়ান।",
};

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

for (const [name, text] of Object.entries(TEXTS)) {
  let done = false;
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        // Send ONLY the words to be spoken. TTS models read any instruction text aloud
        // (an earlier "Say calmly ... like a caring nurse:" prefix ended up in the audio).
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
      }),
    }).catch((e) => ({ ok: false, status: e.message, json: async () => ({}) }));
    const j = await res.json();
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!res.ok || !part) { console.warn(`${name}: ${model} failed (${res.status}) ${j.error?.message?.slice(0, 80) ?? ""}`); continue; }
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000);
    writeFileSync(`public/audio/${name}.wav`, wav(Buffer.from(part.inlineData.data, "base64"), rate));
    console.log(`✓ public/audio/${name}.wav (${model})`);
    done = true;
    break;
  }
  if (!done) console.warn(`✗ ${name}: no TTS model worked; the app will use the browser voice`);
}

/* ---- Verify: transcribe each file and make sure only the Bangla alert text is spoken ---- */
for (const [name, text] of Object.entries(TEXTS)) {
  let audio;
  try { audio = readFileSync(`public/audio/${name}.wav`).toString("base64"); } catch { continue; }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-3.5-flash-lite"}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "audio/wav", data: audio } }, { text: "Transcribe this audio exactly. Output only the transcript." }] }] }),
  }).catch(() => null);
  const heard = (await res?.json().catch(() => null))?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const latin = (heard.match(/[A-Za-z]{3,}/g) ?? []).join(" ");
  console.log(`${latin ? "✗" : "✓"} ${name}: heard "${heard.slice(0, 90)}${heard.length > 90 ? "…" : ""}"${latin ? `  <- unexpected English: ${latin}` : ""}`);
  if (!heard) console.log(`  (could not transcribe ${name}; listen to it manually)`);
  void text;
}
