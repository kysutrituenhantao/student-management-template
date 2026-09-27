import { Hono } from "hono";
import { MAX_WORKS_PER_STUDENT, workInput } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { jsonError, notFound } from "../../lib/errors";
import { decodeImage } from "../../lib/media";
import { ownedStudent } from "../../lib/students";
import { WORK_SELECT, toWork } from "../../lib/works";

/**
 * "Sản phẩm của em" (brief 4, item 5): she photographs a marked test or something a child made, and it hangs on
 * that child's page for the family to look at. Hers to put up and to take down; the family only ever reads.
 */
export const workRoutes = new Hono<AppEnv>();

workRoutes.get("/students/:sid/works", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const { results } = await c.env.DB.prepare(`${WORK_SELECT} WHERE student_id = ? ORDER BY created_at DESC, id DESC`)
    .bind(st.id)
    .all<Record<string, unknown>>();
  return c.json(results.map(toWork));
});

workRoutes.post("/students/:sid/works", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const body = await readJson(c, workInput);
  if (!body.ok) return body.res;
  const img = decodeImage(body.data.dataUrl, "work");
  if (typeof img === "string") return jsonError(c, 400, "bad_image", img, { dataUrl: img });

  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM student_works WHERE student_id = ?")
    .bind(st.id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_WORKS_PER_STUDENT) {
    return jsonError(c, 400, "too_many", `Mỗi bạn giữ tối đa ${MAX_WORKS_PER_STUDENT} sản phẩm. Hãy xoá bớt ảnh cũ.`);
  }

  const row = await c.env.DB.prepare(
    "INSERT INTO student_works (class_id, student_id, title, content_type, data, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, title, created_at",
  )
    .bind(st.class_id, st.id, body.data.title, img.contentType, img.base64, c.get("deps").now().toISOString())
    .first<Record<string, unknown>>();
  return c.json(toWork(row!), 201);
});

workRoutes.delete("/works/:wid", async (c) => {
  const id = idParam(c.req.param("wid"));
  if (id === null) return notFound(c, "Không tìm thấy sản phẩm.");
  const owned = await c.env.DB.prepare(
    "SELECT w.id FROM student_works w JOIN classes c ON c.id = w.class_id WHERE w.id = ? AND c.teacher_id = ?",
  )
    .bind(id, c.get("teacher").id)
    .first<{ id: number }>();
  if (!owned) return notFound(c, "Không tìm thấy sản phẩm.");
  await c.env.DB.prepare("DELETE FROM student_works WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});
