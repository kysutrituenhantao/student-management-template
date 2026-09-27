/**
 * Shrinks a photo in the browser before upload, so the Worker only ever stores small images: avatars are cropped
 * to a square, covers to a wide banner. WebP where the browser can encode it (Safari can't), JPEG otherwise.
 */
export async function resizeImage(
  file: File,
  target: { width: number; height: number; maxBytes: number },
  crop: "cover" | "contain" = "cover",
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Hãy chọn một tấm ảnh.");
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không xử lý được ảnh này.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target.width, target.height);
  const scale =
    crop === "cover"
      ? Math.max(target.width / bitmap.width, target.height / bitmap.height)
      : Math.min(target.width / bitmap.width, target.height / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (target.width - w) / 2, (target.height - h) / 2, w, h);

  for (const quality of [0.86, 0.76, 0.64, 0.5]) {
    let url = canvas.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if ((url.length * 3) / 4 <= target.maxBytes) return url;
  }
  throw new Error("Ảnh này lớn quá. Hãy chọn ảnh khác.");
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to an <img> below (older Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
