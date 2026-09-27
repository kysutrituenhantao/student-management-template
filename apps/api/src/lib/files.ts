import { stripDiacritics, type StudentFile, type StudentFileExt } from "@lhhp/shared";

/** "Tệp hồ sơ". Downloaded through the teacher's API, so only a signed-in teacher's session ever reaches it. */
export const fileUrl = (id: number) => `/api/t/files/${id}`;

export const toStudentFile = (r: Record<string, unknown>): StudentFile => ({
  id: Number(r.id),
  name: String(r.name),
  size: Number(r.size),
  url: fileUrl(Number(r.id)),
  createdAt: String(r.created_at),
});

export const FILE_SELECT = "SELECT id, name, size, created_at FROM student_files";

/** Base64 characters per stored part: a D1 value holds at most 2 MB. A multiple of 4, so each part is whole bytes. */
export const PART_CHARS = 1_500_000;

/*
 * The Workers free plan allows 10 ms of CPU a request, and a JavaScript loop over five million bytes spends that
 * alone. These two are native in workerd (TC39 "Uint8Array to/from base64"), so a whole file costs well under a
 * millisecond each way. The lib this project compiles against does not declare them yet.
 */
type Base64Bytes = Uint8Array & { toBase64(): string };
export const toBase64 = (bytes: Uint8Array) => (bytes as Base64Bytes).toBase64();
export const fromBase64 = (b64: string) => (Uint8Array as unknown as { fromBase64(s: string): Uint8Array }).fromBase64(b64);

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const SIGNATURES: Record<StudentFileExt, number[]> = {
  docx: ZIP,
  xlsx: ZIP,
  pptx: ZIP,
  doc: OLE,
  xls: OLE,
  ppt: OLE,
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
};

/** Whether the file starts the way its extension says it should — a page renamed to .docx is not a Word file. */
export const looksLike = (ext: StudentFileExt, bytes: Uint8Array) => SIGNATURES[ext].every((byte, i) => bytes[i] === byte);

/**
 * The download. `attachment`, because a Word or Excel file is meant to be opened in Word or Excel; the plain
 * `filename` is for old browsers, `filename*` carries the Vietnamese name for everything else. The teacher's routes
 * already answer `cache-control: no-store`, so no cache keeps a copy of a child's records.
 */
export function fileResponse(name: string, contentType: string, b64: string): Response {
  const plain = stripDiacritics(name).replace(/[^\x20-\x7e]|["\\]/g, "_");
  return new Response(fromBase64(b64), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
