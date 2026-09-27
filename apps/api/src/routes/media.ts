import { Hono } from "hono";
import type { AppEnv } from "../types";
import { idParam } from "../lib/body";
import { notFound } from "../lib/errors";
import { imageResponse } from "../lib/media";
import { currentUser } from "../lib/session";

/**
 * Class covers and student photos. Only the class's teacher and its own students can see them: these are children.
 * Anyone else gets the same 404 as a photo that doesn't exist.
 */
export const mediaRoutes = new Hono<AppEnv>();

mediaRoutes.get("/:owner{student|class|post|work}/:id", async (c) => {
  const owner = c.req.param("owner") as "student" | "class" | "post" | "work";
  const id = idParam(c.req.param("id"));
  const who = await currentUser(c);
  if (!who || id === null) return notFound(c);
  if (who.role === "student" && who.student.mustChangePassword) return notFound(c);

  const lookup: Record<"student" | "post" | "work", string> = {
    student: "SELECT class_id, id AS student_id FROM students WHERE id = ?",
    post: "SELECT class_id, NULL AS student_id FROM post_photos WHERE id = ?",
    work: "SELECT class_id, student_id FROM student_works WHERE id = ?",
  };
  const row =
    owner === "class"
      ? { class_id: id, student_id: null }
      : await c.env.DB.prepare(lookup[owner]).bind(id).first<{ class_id: number; student_id: number | null }>();
  if (!row?.class_id) return notFound(c);
  const allowed =
    who.role === "student"
      ? who.student.classId === row.class_id &&
        // A photo of one child's marked test is that child's alone; everything else is the class's.
        (owner !== "work" || who.student.id === row.student_id)
      : !!(await c.env.DB.prepare("SELECT 1 FROM classes WHERE id = ? AND teacher_id = ?").bind(row.class_id, who.teacher.id).first());
  if (!allowed) return notFound(c);

  const table: Record<string, string> = {
    post: "SELECT content_type, data FROM post_photos WHERE id = ?",
    work: "SELECT content_type, data FROM student_works WHERE id = ?",
  };
  const img = table[owner]
    ? await c.env.DB.prepare(table[owner]!).bind(id).first<{ content_type: string; data: string }>()
    : await c.env.DB.prepare("SELECT content_type, data FROM images WHERE owner = ? AND owner_id = ?")
        .bind(owner, id)
        .first<{ content_type: string; data: string }>();
  if (!img) return notFound(c);
  return imageResponse(img.content_type, img.data);
});
