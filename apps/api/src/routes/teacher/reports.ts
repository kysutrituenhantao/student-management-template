import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { idParam } from "../../lib/body";
import { ownedClass, toClassDetail } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { buildClassReport, buildStudentReport, resolvePeriod } from "../../lib/report";
import { ownedStudent } from "../../lib/students";

export const reportRoutes = new Hono<AppEnv>();

reportRoutes.get("/classes/:id/report", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const period = resolvePeriod(c.req.query(), toClassDetail(cls), c.get("deps").now());
  if (typeof period === "string") return jsonError(c, 400, "invalid_query", period);
  return c.json(await buildClassReport(c.env.DB, cls.id, period));
});

reportRoutes.get("/students/:sid/report", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const cls = await ownedClass(c, st.class_id);
  const period = resolvePeriod(c.req.query(), toClassDetail(cls!), c.get("deps").now());
  if (typeof period === "string") return jsonError(c, 400, "invalid_query", period);
  return c.json(await buildStudentReport(c.env.DB, st.class_id, st.id, period));
});
