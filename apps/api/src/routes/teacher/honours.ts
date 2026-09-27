import { Hono } from "hono";
import { honourInput, honourQuery, type Honour, type HonourBoard } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass, toClassDetail } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { HONOUR_SELECT, defaultHonourTitle, honourPeriod, periodLeaders, toHonour } from "../../lib/honours";

/** Vinh danh: the honour roll, by week, month, semester and school year. */
export const honourRoutes = new Hono<AppEnv>();

honourRoutes.get("/classes/:id/honours", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const q = honourQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Khoảng thời gian không hợp lệ.");
  const period = honourPeriod(q.data.period, toClassDetail(cls), c.get("deps").now(), q.data.date, q.data.semester);
  const [given, leaders] = await Promise.all([
    c.env.DB.prepare(`${HONOUR_SELECT} WHERE h.class_id = ? AND h.period = ? AND h.period_key = ? ORDER BY h.created_at, h.id`)
      .bind(cls.id, q.data.period, period.startDate)
      .all<Record<string, unknown>>()
      .then((r) => r.results.map(toHonour)),
    periodLeaders(c.env.DB, cls.id, period),
  ]);
  const body: HonourBoard = { period: q.data.period, periodKey: period.startDate, periodLabel: period.label, given, leaders };
  return c.json(body);
});

/** The whole roll, newest first: what the Vinh danh wall shows. */
honourRoutes.get("/classes/:id/honours/wall", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare(`${HONOUR_SELECT} WHERE h.class_id = ? ORDER BY h.created_at DESC, h.id DESC LIMIT 200`)
    .bind(cls.id)
    .all<Record<string, unknown>>();
  return c.json(results.map(toHonour));
});

honourRoutes.post("/classes/:id/honours", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, honourInput);
  if (!body.ok) return body.res;
  const d = body.data;
  const period = honourPeriod(d.period, toClassDetail(cls), c.get("deps").now(), d.date, d.semester);
  const ids = [...new Set(d.studentIds)];
  const { results: mine } = await c.env.DB.prepare(
    `SELECT id FROM students WHERE class_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
  )
    .bind(cls.id, ...ids)
    .all<{ id: number }>();
  if (mine.length !== ids.length) return notFound(c, "Có bạn không thuộc lớp này.");

  // The drops that earned it, frozen on the day: later points must not rewrite an honour already given.
  const { results: points } = await c.env.DB.prepare(
    `SELECT student_id, COALESCE(SUM(delta), 0) AS points FROM point_events
     WHERE class_id = ? AND created_at >= ? AND created_at < ? AND student_id IN (${ids.map(() => "?").join(",")})
     GROUP BY student_id`,
  )
    .bind(cls.id, period.start, period.end, ...ids)
    .all<{ student_id: number; points: number }>();
  const earned = new Map(points.map((r) => [Number(r.student_id), Number(r.points)]));

  const title = d.title ?? defaultHonourTitle(d.period);
  const now = c.get("deps").now().toISOString();
  await c.env.DB.batch(
    ids.map((sid) =>
      c.env.DB.prepare(
        `INSERT INTO honours (class_id, student_id, period, period_key, period_label, title, note, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (class_id, period, period_key, student_id)
           DO UPDATE SET title = excluded.title, note = excluded.note, points = excluded.points`,
      ).bind(cls.id, sid, d.period, period.startDate, period.label, title, d.note, earned.get(sid) ?? 0, now),
    ),
  );
  const { results } = await c.env.DB.prepare(
    `${HONOUR_SELECT} WHERE h.class_id = ? AND h.period = ? AND h.period_key = ? ORDER BY h.created_at, h.id`,
  )
    .bind(cls.id, d.period, period.startDate)
    .all<Record<string, unknown>>();
  return c.json(results.map(toHonour) as Honour[], 201);
});

honourRoutes.delete("/honours/:hid", async (c) => {
  const hid = idParam(c.req.param("hid"));
  if (hid === null) return notFound(c, "Không tìm thấy danh hiệu.");
  const r = await c.env.DB.prepare(
    "DELETE FROM honours WHERE id = ? AND class_id IN (SELECT id FROM classes WHERE teacher_id = ?)",
  )
    .bind(hid, c.get("teacher").id)
    .run();
  if (!r.meta.changes) return notFound(c, "Không tìm thấy danh hiệu.");
  return c.body(null, 204);
});
