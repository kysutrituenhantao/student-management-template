import { Hono } from "hono";
import { announcementInput, messageInput, type Thread } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass } from "../../lib/classes";
import { notFound } from "../../lib/errors";
import { toAnnouncement, toMessage } from "../../lib/comms";
import { ownedStudent } from "../../lib/students";

export const commsRoutes = new Hono<AppEnv>();

/** One thread per child that has messages, newest first, with unread counts from the family's side. */
commsRoutes.get("/classes/:id/threads", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare(
    `SELECT s.id AS student_id, s.full_name, s.avatar_emoji, m.body AS last_body, m.sender AS last_sender, m.created_at AS last_at,
       (SELECT COUNT(*) FROM messages u WHERE u.student_id = s.id AND u.sender = 'family' AND u.read_at IS NULL) AS unread
     FROM students s
     JOIN messages m ON m.id = (SELECT id FROM messages WHERE student_id = s.id ORDER BY created_at DESC, id DESC LIMIT 1)
     WHERE s.class_id = ? ORDER BY m.created_at DESC`,
  )
    .bind(cls.id)
    .all<Record<string, unknown>>();
  const threads: Thread[] = results.map((r) => ({
    studentId: Number(r.student_id),
    fullName: String(r.full_name),
    avatarEmoji: String(r.avatar_emoji),
    lastBody: String(r.last_body),
    lastSender: r.last_sender as Thread["lastSender"],
    lastAt: String(r.last_at),
    unread: Number(r.unread),
  }));
  return c.json(threads);
});

commsRoutes.get("/students/:sid/messages", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const now = c.get("deps").now().toISOString();
  const [, list] = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE messages SET read_at = ? WHERE student_id = ? AND sender = 'family' AND read_at IS NULL").bind(now, st.id),
    c.env.DB.prepare("SELECT * FROM messages WHERE student_id = ? ORDER BY created_at, id LIMIT 500").bind(st.id),
  ]);
  return c.json((list!.results as Record<string, unknown>[]).map(toMessage));
});

commsRoutes.post("/students/:sid/messages", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const body = await readJson(c, messageInput);
  if (!body.ok) return body.res;
  const row = await c.env.DB.prepare(
    "INSERT INTO messages (class_id, student_id, sender, body, created_at) VALUES (?, ?, 'teacher', ?, ?) RETURNING *",
  )
    .bind(st.class_id, st.id, body.data.body, c.get("deps").now().toISOString())
    .first<Record<string, unknown>>();
  return c.json(toMessage(row!), 201);
});

commsRoutes.get("/classes/:id/announcements", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM announcements WHERE class_id = ? ORDER BY pinned DESC, created_at DESC, id DESC LIMIT 100",
  )
    .bind(cls.id)
    .all<Record<string, unknown>>();
  return c.json(results.map(toAnnouncement));
});

commsRoutes.post("/classes/:id/announcements", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, announcementInput);
  if (!body.ok) return body.res;
  const now = c.get("deps").now().toISOString();
  const row = await c.env.DB.prepare(
    "INSERT INTO announcements (class_id, title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
  )
    .bind(cls.id, body.data.title, body.data.body, body.data.pinned ? 1 : 0, now, now)
    .first<Record<string, unknown>>();
  return c.json(toAnnouncement(row!), 201);
});

async function ownedAnnouncement(c: Parameters<typeof ownedClass>[0], aid: number | null) {
  if (aid === null) return null;
  return c.env.DB.prepare(
    "SELECT a.* FROM announcements a JOIN classes c ON c.id = a.class_id WHERE a.id = ? AND c.teacher_id = ?",
  )
    .bind(aid, c.get("teacher").id)
    .first<Record<string, unknown>>();
}

commsRoutes.patch("/announcements/:aid", async (c) => {
  const a = await ownedAnnouncement(c, idParam(c.req.param("aid")));
  if (!a) return notFound(c, "Không tìm thấy thông báo.");
  const body = await readJson(c, announcementInput);
  if (!body.ok) return body.res;
  const now = c.get("deps").now().toISOString();
  await c.env.DB.prepare("UPDATE announcements SET title = ?, body = ?, pinned = ?, updated_at = ? WHERE id = ?")
    .bind(body.data.title, body.data.body, body.data.pinned ? 1 : 0, now, a.id)
    .run();
  return c.json(toAnnouncement({ ...a, title: body.data.title, body: body.data.body, pinned: body.data.pinned ? 1 : 0 }));
});

commsRoutes.delete("/announcements/:aid", async (c) => {
  const a = await ownedAnnouncement(c, idParam(c.req.param("aid")));
  if (!a) return notFound(c, "Không tìm thấy thông báo.");
  await c.env.DB.prepare("DELETE FROM announcements WHERE id = ?").bind(a.id).run();
  return c.body(null, 204);
});
