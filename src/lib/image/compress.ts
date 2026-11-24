/**
 * Browser-only. Resize a photo so its long side is at most `maxSide` px and re-encode as JPEG.
 * A 12 MP phone photo (~4 MB) becomes ~200-400 KB, well under the Vercel body limit,
 * and still sharp enough for the vision model to read a printed CBC report.
 */
export async function compressImage(
  file: File,
  maxSide = 1600,
  quality = 0.8,
): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}
