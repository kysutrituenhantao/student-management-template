import { Hono } from "hono";
import { BADGE_BY_KEY, badgeLabelInput, competitionInput, competitionQuery, type BadgeDef } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass, toClassDetail } from "../../lib/classes";
import { classBadgeDefs, competitionLabel, enteredPeriods, lastNames, loadRanking, roundScore } from "../../lib/competition";
import { jsonError, notFound } from "../../lib/errors";
import { honourPeriod } from "../../lib/honours";

/**
 * Thi đua (brief 12): the school's emulation results she types in for each week or month, and her own words and
 * icons for the class's badges.
 */
export const competitionRoutes = new Hono<AppEnv>();

competitionRoutes.get("/classes/:id/competition", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const q = competitionQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Khoảng thời gian không hợp lệ.");
  const detail = toClassDetail(cls);
  const period = honourPeriod(q.data.period, detail, c.get("deps").now(), q.data.date);
  const ranking = await loadRanking(c.env.DB, cls.id, q.data.period, period, detail.semesters);
  if (ranking.rows.length === 0) ranking.lastNames = await lastNames(c.env.DB, cls.id, q.data.period, period.startDate);
  return c.json(ranking);
});

/** Saves one period whole: the list she sees is the list that is kept. */
competitionRoutes.put("/classes/:id/competition", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, competitionInput);
  if (!body.ok) return body.res;
  const { period: kind, date, rows } = body.data;
  const detail = toClassDetail(cls);
  const period = honourPeriod(kind, detail, c.get("deps").now(), date);
  const db = c.env.DB;
  const now = c.get("deps").now().toISOString();
  const result = "(SELECT id FROM competition_results WHERE class_id = ? AND period = ? AND period_key = ?)";
  const key = [cls.id, kind, period.startDate];
  await db.batch([
    db
      .prepare(
        `INSERT INTO competition_results (class_id, period, period_key, period_label, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (class_id, period, period_key) DO UPDATE SET period_label = excluded.period_label, updated_at = excluded.updated_at`,
      )
      .bind(...key, competitionLabel(kind, period.startDate, detail.semesters), now),
    db.prepare(`DELETE FROM competition_rows WHERE result_id = ${result}`).bind(...key),
    ...rows.map((r, seq) =>
      db
        .prepare(`INSERT INTO competition_rows (result_id, seq, name, score, is_ours) VALUES (${result}, ?, ?, ?, ?)`)
        .bind(...key, seq, r.name, roundScore(r.score), r.isOurs ? 1 : 0),
    ),
  ]);
  return c.json(await loadRanking(db, cls.id, kind, period, detail.semesters));
});

competitionRoutes.get("/classes/:id/competition/entered", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  return c.json(await enteredPeriods(c.env.DB, cls.id, toClassDetail(cls).semesters));
});

competitionRoutes.delete("/classes/:id/competition", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const q = competitionQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Khoảng thời gian không hợp lệ.");
  const period = honourPeriod(q.data.period, toClassDetail(cls), c.get("deps").now(), q.data.date);
  await c.env.DB.prepare("DELETE FROM competition_results WHERE class_id = ? AND period = ? AND period_key = ?")
    .bind(cls.id, q.data.period, period.startDate)
    .run();
  return c.body(null, 204);
});

competitionRoutes.get("/classes/:id/badge-defs", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  return c.json(await classBadgeDefs(c.env.DB, cls.id));
});

/** Her icon, name and description for one badge. An automatic badge keeps its milestone; only its words change. */
competitionRoutes.put("/classes/:id/badge-defs/:key", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const def = BADGE_BY_KEY[c.req.param("key")];
  if (!def) return notFound(c, "Không có huy hiệu này.");
  const body = await readJson(c, badgeLabelInput);
  if (!body.ok) return body.res;
  const b = body.data;
  await c.env.DB.prepare(
    `INSERT INTO badge_labels (class_id, badge_key, emoji, name, description) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (class_id, badge_key) DO UPDATE SET emoji = excluded.emoji, name = excluded.name, description = excluded.description`,
  )
    .bind(cls.id, def.key, b.emoji, b.name, b.description)
    .run();
  const edited: BadgeDef = { ...def, emoji: b.emoji, name: b.name, description: b.description };
  return c.json(edited);
});
