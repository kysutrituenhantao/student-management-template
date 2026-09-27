import { Hono } from "hono";
import { z } from "zod";
import { BADGE_BY_KEY, badgeAwardInput, redemptionDecision, rewardInput, rewardPatch } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { log } from "../../lib/log";
import { insertRedemption, toRedemption, toReward } from "../../lib/rewards";
import { availableDrops } from "../../lib/stats";
import { ownedStudent } from "../../lib/students";

export const rewardRoutes = new Hono<AppEnv>();

async function ownedReward(c: Parameters<typeof ownedClass>[0], rid: number | null) {
  if (rid === null) return null;
  return c.env.DB.prepare(
    "SELECT r.* FROM rewards r JOIN classes c ON c.id = r.class_id WHERE r.id = ? AND c.teacher_id = ?",
  )
    .bind(rid, c.get("teacher").id)
    .first<Record<string, unknown>>();
}

rewardRoutes.get("/classes/:id/rewards", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare("SELECT * FROM rewards WHERE class_id = ? ORDER BY sort_order, cost, id")
    .bind(cls.id)
    .all<Record<string, unknown>>();
  return c.json(results.map(toReward));
});

rewardRoutes.post("/classes/:id/rewards", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, rewardInput);
  if (!body.ok) return body.res;
  const r = body.data;
  const row = await c.env.DB.prepare(
    `INSERT INTO rewards (class_id, name, emoji, cost, active, sort_order)
     VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM rewards WHERE class_id = ?)) RETURNING *`,
  )
    .bind(cls.id, r.name, r.emoji, r.cost, r.active ? 1 : 0, cls.id)
    .first<Record<string, unknown>>();
  return c.json(toReward(row!), 201);
});

rewardRoutes.patch("/rewards/:rid", async (c) => {
  const reward = await ownedReward(c, idParam(c.req.param("rid")));
  if (!reward) return notFound(c, "Không tìm thấy phần quà.");
  const body = await readJson(c, rewardPatch);
  if (!body.ok) return body.res;
  const next = { ...toReward(reward), ...body.data };
  await c.env.DB.prepare("UPDATE rewards SET name = ?, emoji = ?, cost = ?, active = ? WHERE id = ?")
    .bind(next.name, next.emoji, next.cost, next.active ? 1 : 0, reward.id)
    .run();
  return c.json(next);
});

rewardRoutes.delete("/rewards/:rid", async (c) => {
  const reward = await ownedReward(c, idParam(c.req.param("rid")));
  if (!reward) return notFound(c, "Không tìm thấy phần quà.");
  await c.env.DB.prepare("DELETE FROM rewards WHERE id = ?").bind(reward.id).run();
  return c.body(null, 204);
});

rewardRoutes.get("/classes/:id/redemptions", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const status = c.req.query("status");
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, s.full_name FROM redemptions r JOIN students s ON s.id = r.student_id
     WHERE r.class_id = ? ${status ? "AND r.status = ?" : ""} ORDER BY r.status = 'pending' DESC, r.requested_at DESC LIMIT 200`,
  )
    .bind(...(status ? [cls.id, status] : [cls.id]))
    .all<Record<string, unknown>>();
  return c.json(results.map(toRedemption));
});

/** The teacher hands out a reward in person: recorded as approved at once, if the child has the drops. */
rewardRoutes.post("/classes/:id/redemptions", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, z.object({ studentId: z.number().int().positive(), rewardId: z.number().int().positive() }));
  if (!body.ok) return body.res;
  const st = await ownedStudent(c, body.data.studentId);
  const reward = await ownedReward(c, body.data.rewardId);
  if (!st || st.class_id !== cls.id || !reward || Number(reward.class_id) !== cls.id) {
    return jsonError(c, 400, "invalid_input", "Học sinh hoặc phần quà không thuộc lớp này.");
  }
  const row = await insertRedemption(c.env.DB, {
    classId: cls.id,
    studentId: st.id,
    reward,
    now: c.get("deps").now().toISOString(),
  });
  if (!row) {
    const available = await availableDrops(c.env.DB, st.id);
    return jsonError(c, 400, "not_enough_stars", `${st.full_name} mới có ${available} 💧, chưa đủ ${reward.cost} 💧.`);
  }
  return c.json(toRedemption({ ...row!, full_name: st.full_name }), 201);
});

rewardRoutes.patch("/redemptions/:rid", async (c) => {
  const red = await c.env.DB.prepare(
    `SELECT r.*, s.full_name FROM redemptions r JOIN classes c ON c.id = r.class_id JOIN students s ON s.id = r.student_id
     WHERE r.id = ? AND c.teacher_id = ?`,
  )
    .bind(idParam(c.req.param("rid")), c.get("teacher").id)
    .first<Record<string, unknown>>();
  if (!red) return notFound(c, "Không tìm thấy yêu cầu đổi quà.");
  const body = await readJson(c, redemptionDecision);
  if (!body.ok) return body.res;
  if (red.status !== "pending") return jsonError(c, 409, "already_decided", "Yêu cầu này đã được xử lý.");
  const now = c.get("deps").now().toISOString();
  await c.env.DB.prepare("UPDATE redemptions SET status = ?, decided_at = ? WHERE id = ?").bind(body.data.status, now, red.id).run();
  log("info", "redemption_decided", { reqId: c.get("reqId"), id: red.id, status: body.data.status });
  return c.json(toRedemption({ ...red, status: body.data.status, decided_at: now }));
});

/** Which badges each student holds, for the class's badge board. */
rewardRoutes.get("/classes/:id/badges", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare(
    "SELECT student_id, badge_key, source, note, awarded_at FROM student_badges WHERE class_id = ? ORDER BY awarded_at",
  )
    .bind(cls.id)
    .all<{ student_id: number; badge_key: string; source: string; note: string | null; awarded_at: string }>();
  return c.json(
    results.map((r) => ({ studentId: r.student_id, key: r.badge_key, source: r.source, note: r.note, awardedAt: r.awarded_at })),
  );
});

rewardRoutes.post("/classes/:id/badges", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, badgeAwardInput);
  if (!body.ok) return body.res;
  const def = BADGE_BY_KEY[body.data.badgeKey];
  if (!def || def.auto) return jsonError(c, 400, "invalid_input", "Huy hiệu này do ứng dụng tự trao.");
  const ids = [...new Set(body.data.studentIds)];
  const found = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM students WHERE class_id = ? AND id IN (${ids.map(() => "?").join(",")})`)
    .bind(cls.id, ...ids)
    .first<{ n: number }>();
  if (Number(found?.n) !== ids.length) return jsonError(c, 400, "invalid_input", "Có học sinh không thuộc lớp này.");
  const now = c.get("deps").now().toISOString();
  const res = await c.env.DB.batch(
    ids.map((sid) =>
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO student_badges (class_id, student_id, badge_key, source, note, awarded_at) VALUES (?, ?, ?, 'teacher', ?, ?)",
      ).bind(cls.id, sid, def.key, body.data.note ?? null, now),
    ),
  );
  return c.json({ awarded: res.reduce((n, r) => n + r.meta.changes, 0) }, 201);
});

rewardRoutes.delete("/students/:sid/badges/:key", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  await c.env.DB.prepare("DELETE FROM student_badges WHERE student_id = ? AND badge_key = ?").bind(st.id, c.req.param("key")).run();
  return c.body(null, 204);
});
