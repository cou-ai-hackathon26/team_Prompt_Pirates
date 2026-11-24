import { decodeTo16kMono } from "./toWav";

/**
 * Browser-only. Recorded blob -> 16 kHz mono MP3. At 32 kbps that is 4 KB per second, so a
 * 2-minute day summary is ~480 KB (the same clip as WAV is ~3.8 MB, over Vercel's body limit).
 * Gemini and Groq Whisper both accept MP3. The encoder is loaded only when needed.
 */
export const MP3_KBPS = 32;

export async function blobToMp3(blob: Blob, kbps = MP3_KBPS): Promise<Blob> {
  const [{ Mp3Encoder }, samples] = await Promise.all([
    import("@breezystack/lamejs"),
    decodeTo16kMono(blob),
  ]);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const enc = new Mp3Encoder(1, 16_000, kbps);
  const chunks: Uint8Array[] = [];
  const FRAME = 1152 * 8;
  for (let i = 0; i < pcm.length; i += FRAME) {
    const out = enc.encodeBuffer(pcm.subarray(i, i + FRAME));
    if (out.length) chunks.push(out);
  }
  const end = enc.flush();
  if (end.length) chunks.push(end);
  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}
