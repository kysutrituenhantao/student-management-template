import { Hono } from "hono";
import {
  FILE_TOO_LARGE,
  FILE_WRONG_TYPE,
  MAX_FILES_PER_STUDENT,
  MAX_FILE_BYTES,
  MAX_FILE_BYTES_PER_CLASS,
  MAX_FILE_NAME,
  STUDENT_FILE_TYPES,
  studentFileExt,
} from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam } from "../../lib/body";
import { jsonError, notFound } from "../../lib/errors";
import { FILE_SELECT, PART_CHARS, fileResponse, looksLike, toBase64, toStudentFile } from "../../lib/files";
import { ownedStudent } from "../../lib/students";

/**
 * "Tệp hồ sơ" (brief 5, item 2): the Word, Excel and PDF files that complete a child's Măng non page. Hers to put
 * up, download and delete; nobody else is ever served one.
 *
 * She took the section off the page the same evening ("Bỏ mục này", brief 8). These routes stay so nothing already
 * uploaded is lost — deleting a real class's data is the teacher's call — but no screen reaches them any more.
 */
export const fileRoutes = new Hono<AppEnv>();

fileRoutes.get("/students/:sid/files", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const { results } = await c.env.DB.prepare(`${FILE_SELECT} WHERE student_id = ? ORDER BY created_at DESC, id DESC`)
    .bind(st.id)
    .all<Record<string, unknown>>();
  return c.json(results.map(toStudentFile));
});

/**
 * The file arrives as raw bytes (`application/octet-stream`) with its name in `?name=`, rather than as base64 in
 * JSON: parsing seven megabytes of JSON alone would spend the free plan's 10 ms of CPU.
 */
fileRoutes.post("/students/:sid/files", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const name = (c.req.query("name") ?? "").trim();
  if (!name) return jsonError(c, 400, "invalid_input", "Tệp chưa có tên.");
  if (name.length > MAX_FILE_NAME) return jsonError(c, 400, "invalid_input", `Tên tệp quá dài (tối đa ${MAX_FILE_NAME} ký tự).`);
  const ext = studentFileExt(name);
  if (!ext) return jsonError(c, 400, "bad_type", FILE_WRONG_TYPE);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) return jsonError(c, 413, "too_large", FILE_TOO_LARGE);
  if (bytes.length === 0 || !looksLike(ext, bytes)) {
    return jsonError(c, 400, "bad_file", "Tệp này bị hỏng, hoặc không đúng loại như tên của nó.");
  }

  const used = await c.env.DB.prepare(
    "SELECT COUNT(CASE WHEN student_id = ? THEN 1 END) AS mine, COALESCE(SUM(size), 0) AS bytes FROM student_files WHERE class_id = ?",
  )
    .bind(st.id, st.class_id)
    .first<{ mine: number; bytes: number }>();
  if ((used?.mine ?? 0) >= MAX_FILES_PER_STUDENT) {
    return jsonError(c, 400, "too_many", `Mỗi bạn giữ tối đa ${MAX_FILES_PER_STUDENT} tệp. Hãy xoá bớt tệp cũ.`);
  }
  if ((used?.bytes ?? 0) + bytes.length > MAX_FILE_BYTES_PER_CLASS) {
    return jsonError(c, 400, "class_full", `Tệp hồ sơ của cả lớp đã gần ${MAX_FILE_BYTES_PER_CLASS / 1024 / 1024} MB. Hãy xoá bớt tệp cũ.`);
  }

  // One batch is one transaction: the file and all its parts are written, or none of them. The parts table has no
  // rowid, so last_insert_rowid() is still the file's while its parts go in.
  const db = c.env.DB;
  const data = toBase64(bytes);
  const parts = [];
  for (let seq = 0; seq * PART_CHARS < data.length; seq++) {
    parts.push(
      db
        .prepare("INSERT INTO student_file_parts (file_id, seq, data) VALUES (last_insert_rowid(), ?, ?)")
        .bind(seq, data.slice(seq * PART_CHARS, (seq + 1) * PART_CHARS)),
    );
  }
  const [inserted] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        "INSERT INTO student_files (class_id, student_id, name, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, size, created_at",
      )
      .bind(st.class_id, st.id, name, STUDENT_FILE_TYPES[ext], bytes.length, c.get("deps").now().toISOString()),
    ...parts,
  ]);
  return c.json(toStudentFile(inserted!.results[0]!), 201);
});

/** The file, if it belongs to one of the signed-in teacher's classes. */
async function ownedFile(c: Parameters<typeof ownedStudent>[0], raw: string | undefined) {
  const id = idParam(raw);
  if (id === null) return null;
  return c.env.DB.prepare(
    "SELECT f.id, f.name, f.content_type FROM student_files f JOIN classes c ON c.id = f.class_id WHERE f.id = ? AND c.teacher_id = ?",
  )
    .bind(id, c.get("teacher").id)
    .first<{ id: number; name: string; content_type: string }>();
}

fileRoutes.get("/files/:fid", async (c) => {
  const f = await ownedFile(c, c.req.param("fid"));
  if (!f) return notFound(c, "Không tìm thấy tệp.");
  const { results } = await c.env.DB.prepare("SELECT data FROM student_file_parts WHERE file_id = ? ORDER BY seq")
    .bind(f.id)
    .all<{ data: string }>();
  return fileResponse(f.name, f.content_type, results.map((p) => p.data).join(""));
});

fileRoutes.delete("/files/:fid", async (c) => {
  const f = await ownedFile(c, c.req.param("fid"));
  if (!f) return notFound(c, "Không tìm thấy tệp.");
  await c.env.DB.prepare("DELETE FROM student_files WHERE id = ?").bind(f.id).run();
  return c.body(null, 204);
});
