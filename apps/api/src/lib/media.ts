import { IMAGE_LIMITS } from "@lhhp/shared";

/**
 * Versioned, so a new photo gets a new URL and no cache serves the old one. `version` only ever goes up — it counts
 * the photos this child has had, not whether there is one now — because the answer is cached `immutable` for a year
 * and a URL that comes round twice shows the wrong face. `hasPhoto` is what says there is one.
 */
export const avatarUrl = (studentId: number, version: number, hasPhoto: boolean) =>
  hasPhoto ? `/api/media/student/${studentId}?v=${version}` : null;
export const coverUrl = (classId: number, version: number) => (version > 0 ? `/api/media/class/${classId}?v=${version}` : null);

export interface DecodedImage {
  contentType: string;
  base64: string;
  bytes: number;
}

/** A data URL from the browser (already resized there) → its parts, or an error message. */
export function decodeImage(dataUrl: string, kind: keyof typeof IMAGE_LIMITS): DecodedImage | string {
  const m = dataUrl.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+=*)$/);
  if (!m) return "Ảnh không hợp lệ.";
  const base64 = m[2]!;
  if (base64.length % 4 !== 0) return "Ảnh không hợp lệ.";
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (bytes > IMAGE_LIMITS[kind].maxBytes) return "Ảnh quá lớn. Hãy chọn ảnh khác.";
  let head: string;
  try {
    // Decode it all once, so a stored photo can always be served.
    head = atob(base64).slice(0, 24);
  } catch {
    return "Ảnh không hợp lệ.";
  }
  if (head.length < 12) return "Ảnh không hợp lệ.";
  const sig = [...head].map((ch) => ch.charCodeAt(0));
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
  const isJpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
  const isWebp = head.startsWith("RIFF") && head.slice(8, 12) === "WEBP";
  const ok = (m[1] === "image/png" && isPng) || (m[1] === "image/jpeg" && isJpeg) || (m[1] === "image/webp" && isWebp);
  if (!ok) return "Ảnh không hợp lệ.";
  return { contentType: m[1]!, base64, bytes };
}

export function imageResponse(contentType: string, base64: string): Response {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      // Children's photos: only the browser that asked may keep a copy. The URL is versioned.
      "cache-control": "private, max-age=31536000, immutable",
      // Shown in the page, never offered as a download: "PH k tải đc tài liệu do gv upload mà chỉ xem".
      "content-disposition": "inline",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
