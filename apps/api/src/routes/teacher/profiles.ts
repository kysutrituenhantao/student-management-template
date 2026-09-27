import { Hono } from "hono";
import { profileInput, type MangNonRow, type TeamRace } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass, toClassDetail } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { MANG_NON_SELECT, toMangNonRow } from "../../lib/profiles";
import { resolvePeriod } from "../../lib/report";
import { ownedStudent } from "../../lib/students";
import { teamRace } from "../../lib/teams";

/** Hồ sơ Măng non and the tổ race: who the children are, and how their teams are doing. */
export const profileRoutes = new Hono<AppEnv>();

profileRoutes.get("/classes/:id/mang-non", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const teams = toClassDetail(cls).teams;
  const { results } = await c.env.DB.prepare(`${MANG_NON_SELECT} WHERE s.class_id = ? ORDER BY s.sort_order, s.id`)
    .bind(cls.id)
    .all<Record<string, unknown>>();
  return c.json(results.map((r) => toMangNonRow(r, teams)) as MangNonRow[]);
});

profileRoutes.patch("/students/:sid/profile", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const body = await readJson(c, profileInput);
  if (!body.ok) return body.res;
  const p = body.data;
  const cols: [string, unknown][] = [];
  if (p.birthday !== undefined) cols.push(["birthday", p.birthday ?? null]);
  if (p.gender !== undefined) cols.push(["gender", p.gender ?? null]);
  if (p.hobby !== undefined) cols.push(["hobby", p.hobby]);
  if (p.dream !== undefined) cols.push(["dream", p.dream]);
  if (p.duty !== undefined) cols.push(["duty", p.duty]);
  if (cols.length) {
    await c.env.DB.prepare(`UPDATE students SET ${cols.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
      .bind(...cols.map(([, v]) => v), c.get("deps").now().toISOString(), st.id)
      .run();
  }
  const cls = await ownedClass(c, st.class_id);
  const row = await c.env.DB.prepare(`${MANG_NON_SELECT} WHERE s.id = ?`).bind(st.id).first<Record<string, unknown>>();
  return c.json(toMangNonRow(row!, toClassDetail(cls!).teams));
});

/** Thi đua theo tổ over a week, a month, a semester or the school year. */
profileRoutes.get("/classes/:id/teams", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const detail = toClassDetail(cls);
  const period = resolvePeriod(c.req.query(), detail, c.get("deps").now());
  if (typeof period === "string") return jsonError(c, 400, "invalid_query", period);
  return c.json((await teamRace(c.env.DB, cls.id, detail.teams, period)) as TeamRace);
});
