/**
 * Checks that the compressed 16 kHz / 32 kbps MP3 the app now sends is still understood.
 * Encodes each validation clip to MP3 and runs it through BOTH paths:
 * Gemini (primary) and Groq Whisper + LLM (fallback). Bypasses the AI cache.
 *
 * Run:  pnpm tsx scripts/validation/mp3-check.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { Mp3Encoder } from "@breezystack/lamejs";
import { geminiJson } from "~/lib/ai/gemini";
import { groqJson, groqTranscribe } from "~/lib/ai/groq";
import { VOICE_EXTRACTION_PROMPT, VOICE_TEXT_EXTRACTION_PROMPT } from "~/lib/ai/prompts";
import { voiceExtractionSchema } from "~/lib/ai/schemas";

const DIR = "scripts/validation/audio";

/** Minimal PCM16 WAV reader + linear resample to 16 kHz mono. */
function wavTo16k(buf: Buffer): Int16Array {
  let off = 12;
  let rate = 16000, channels = 1, data: Buffer | null = null;
  while (off < buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(off + 10);
      rate = buf.readUInt32LE(off + 12);
    } else if (id === "data") data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size;
  }
  if (!data) throw new Error("no data chunk");
  const n = Math.floor(data.length / 2 / channels);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = data.readInt16LE(i * 2 * channels) / 32768;
  const outN = Math.floor((n * 16000) / rate);
  const out = new Int16Array(outN);
  for (let i = 0; i < outN; i++) {
    const x = (i * rate) / 16000;
    const j = Math.floor(x);
    const v = (mono[j] ?? 0) + ((mono[j + 1] ?? 0) - (mono[j] ?? 0)) * (x - j);
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return out;
}

function toMp3(pcm: Int16Array, kbps = 32): Buffer {
  const enc = new Mp3Encoder(1, 16000, kbps);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 9216) parts.push(enc.encodeBuffer(pcm.subarray(i, i + 9216)));
  parts.push(enc.flush());
  return Buffer.concat(parts.map((p) => Buffer.from(p)));
}

for (const f of readdirSync(DIR).filter((x) => x.endsWith(".wav"))) {
  const wav = readFileSync(`${DIR}/${f}`);
  const mp3 = toMp3(wavTo16k(wav), Number(process.env.KBPS ?? 32));
  console.log(`\n=== ${f}: WAV ${(wav.length / 1024).toFixed(0)} KB -> MP3 ${(mp3.length / 1024).toFixed(0)} KB`);
  try {
    const g = await geminiJson({
      prompt: VOICE_EXTRACTION_PROMPT,
      schema: voiceExtractionSchema,
      files: [{ data: mp3.toString("base64"), mimeType: "audio/mpeg" }],
    });
    console.log(`gemini: ${g.transcriptBn}`);
  } catch (e) {
    console.log(`gemini: FAILED ${(e as Error).message.slice(0, 120)}`);
  }
  try {
    const t = await groqTranscribe(mp3, "audio.mp3");
    console.log(`groq:   ${t}`);
    const x = await groqJson({ prompt: VOICE_TEXT_EXTRACTION_PROMPT(t), schema: voiceExtractionSchema });
    console.log(`        symptoms ok: ${Object.values(x.symptoms).filter((v) => v != null).length} fields filled`);
  } catch (e) {
    console.log(`groq:   FAILED ${(e as Error).message.slice(0, 120)}`);
  }
}
