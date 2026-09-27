import { Hono } from "hono";
import { attendanceInput, attendanceQuery, localDate } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { loadAttendance, registerStatements } from "../../lib/attendance";
import { idParam, readJson } from "../../lib/body";
import { ownedClass, toClassDetail } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { resolvePeriod } from "../../lib/report";

/** Theo dõi chuyên cần: the day's register, and how the class has attended over a week, month, semester or year. */
export const attendanceRoutes = new Hono<AppEnv>();

attendanceRoutes.get("/classes/:id/attendance", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const q = attendanceQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Ngày không hợp lệ.");
  const period = resolvePeriod(c.req.query(), toClassDetail(cls), c.get("deps").now());
  if (typeof period === "string") return jsonError(c, 400, "invalid_query", period);
  const day = q.data.day ?? localDate(c.get("deps").now());
  return c.json(await loadAttendance(c.env.DB, cls.id, day, period));
});

attendanceRoutes.put("/classes/:id/attendance", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, attendanceInput);
  if (!body.ok) return body.res;
  const now = c.get("deps").now();
  const today = localDate(now);
  const day = body.data.day ?? today;
  if (day > today) return jsonError(c, 400, "future_day", "Chưa điểm danh cho ngày chưa tới được.");

  const ids = [...new Set(body.data.marks.map((m) => m.studentId))];
  const { results } = await c.env.DB.prepare(
    `SELECT id FROM students WHERE class_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
  )
    .bind(cls.id, ...ids)
    .all<{ id: number }>();
  if (results.length !== ids.length) return notFound(c, "Có bạn không thuộc lớp này.");

  await c.env.DB.batch(registerStatements(c.env.DB, cls.id, day, body.data.marks, now.toISOString()));
  const period = resolvePeriod(c.req.query(), toClassDetail(cls), now);
  if (typeof period === "string") return jsonError(c, 400, "invalid_query", period);
  return c.json(await loadAttendance(c.env.DB, cls.id, day, period));
});
