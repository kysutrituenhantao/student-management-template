import { Hono } from "hono";
import { QUICK_REASON, levelFor, pointReasonPatch, pointsInput, reasonInput, type PointsResult, type Reason } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { log } from "../../lib/log";
import { awardAutoBadges, toPointEvent } from "../../lib/stats";

export const pointRoutes = new Hono<AppEnv>();

interface ReasonRow {
  id: number;
  class_id: number;
  label: string;
  emoji: string;
  category: Reason["category"];
  kind: Reason["kind"];
  drops: number;
}

async function ownedReason(c: Parameters<typeof ownedClass>[0], rid: number | null): Promise<ReasonRow | null> {
  if (rid === null) return null;
  return c.env.DB.prepare(
    `SELECT r.id, r.class_id, r.label, r.emoji, r.category, r.kind, r.drops FROM point_reasons r JOIN classes c ON c.id = r.class_id
     WHERE r.id = ? AND c.teacher_id = ?`,
  )
    .bind(rid, c.get("teacher").id)
    .first<ReasonRow>();
}

const toReason = (r: ReasonRow): Reason => ({
  id: r.id,
  label: r.label,
  emoji: r.emoji,
  category: r.category,
  kind: r.kind,
  drops: Number(r.drops),
});

pointRoutes.get("/classes/:id/reasons", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare(
    "SELECT id, class_id, label, emoji, category, kind, drops FROM point_reasons WHERE class_id = ? AND archived = 0 ORDER BY sort_order, id",
  )
    .bind(cls.id)
    .all<ReasonRow>();
  return c.json(results.map(toReason));
});

pointRoutes.post("/classes/:id/reasons", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, reasonInput);
  if (!body.ok) return body.res;
  const r = body.data;
  const row = await c.env.DB.prepare(
    `INSERT INTO point_reasons (class_id, label, emoji, category, kind, drops, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM point_reasons WHERE class_id = ?))
     RETURNING id, class_id, label, emoji, category, kind, drops`,
  )
    .bind(cls.id, r.label, r.emoji, r.category, r.kind, r.drops, cls.id)
    .first<ReasonRow>();
  return c.json(toReason(row!), 201);
});

pointRoutes.patch("/reasons/:rid", async (c) => {
  const reason = await ownedReason(c, idParam(c.req.param("rid")));
  if (!reason) return notFound(c, "Không tìm thấy lý do.");
  const body = await readJson(c, reasonInput);
  if (!body.ok) return body.res;
  const r = body.data;
  await c.env.DB.prepare("UPDATE point_reasons SET label = ?, emoji = ?, category = ?, kind = ?, drops = ? WHERE id = ?")
    .bind(r.label, r.emoji, r.category, r.kind, r.drops, reason.id)
    .run();
  return c.json(toReason({ ...reason, ...r }));
});

/** Archived, not deleted: past points keep their reason text either way. */
pointRoutes.delete("/reasons/:rid", async (c) => {
  const reason = await ownedReason(c, idParam(c.req.param("rid")));
  if (!reason) return notFound(c, "Không tìm thấy lý do.");
  await c.env.DB.prepare("UPDATE point_reasons SET archived = 1 WHERE id = ?").bind(reason.id).run();
  return c.body(null, 204);
});

/**
 * One tap on a sticker (+💧 / −💧), or one award to several selected students. The reason is optional: a quick tap
 * is stored as "Khen nhanh" / "Nhắc nhở" and the teacher can name the reason later from the history.
 */
pointRoutes.post("/classes/:id/points", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, pointsInput);
  if (!body.ok) return body.res;
  const { delta, reasonId } = body.data;
  const studentIds = [...new Set(body.data.studentIds)];
  const db = c.env.DB;
  const marks = studentIds.map(() => "?").join(",");

  let reason: { label: string; emoji: string; category: Reason["category"] };
  if (reasonId !== undefined) {
    const r = await ownedReason(c, reasonId);
    if (!r || r.class_id !== cls.id) return jsonError(c, 400, "invalid_input", "Lý do không thuộc lớp này.");
    // An "Điểm trừ" criterion never adds a drop, and an "Điểm cộng" one never takes one away.
    if ((r.kind === "plus") !== delta > 0) {
      return jsonError(c, 400, "invalid_input", r.kind === "plus" ? `“${r.label}” là điểm cộng.` : `“${r.label}” là điểm trừ.`);
    }
    reason = r;
  } else {
    reason = { label: delta > 0 ? QUICK_REASON.plus : QUICK_REASON.minus, emoji: delta > 0 ? "💧" : "🔔", category: "chung" };
  }

  const { results: members } = await db
    .prepare(`SELECT id, full_name FROM students WHERE class_id = ? AND id IN (${marks})`)
    .bind(cls.id, ...studentIds)
    .all<{ id: number; full_name: string }>();
  const names = new Map(members.map((r) => [r.id, r.full_name]));
  if (names.size !== studentIds.length) return jsonError(c, 400, "invalid_input", "Có học sinh không thuộc lớp này.");

  const batchId = crypto.randomUUID();
  const now = c.get("deps").now().toISOString();
  const inserted = await db.batch(
    studentIds.map((sid) =>
      db
        .prepare(
          `INSERT INTO point_events (class_id, student_id, delta, category, reason, emoji, source, batch_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?) RETURNING *`,
        )
        .bind(cls.id, sid, delta, reason.category, reason.label, reason.emoji, batchId, now),
    ),
  );
  const events = inserted.map((r) => {
    const row = r.results[0] as Record<string, unknown>;
    return toPointEvent({ ...row, full_name: names.get(Number(row.student_id)) });
  });

  // Each new event's own running total, counted after the insert: two taps that race each other see different totals,
  // so a level crossed between them is reported once, by the tap that crossed it.
  const levelUps: PointsResult["levelUps"] = [];
  if (delta > 0) {
    const { results: totals } = await db
      .prepare(
        `SELECT e.student_id, (SELECT COALESCE(SUM(x.delta), 0) FROM point_events x
                                WHERE x.student_id = e.student_id AND x.delta > 0 AND x.id <= e.id) AS through
         FROM point_events e WHERE e.batch_id = ?`,
      )
      .bind(batchId)
      .all<{ student_id: number; through: number }>();
    for (const t of totals) {
      const after = levelFor(Number(t.through)).level;
      if (after > levelFor(Number(t.through) - delta).level) {
        levelUps.push({ studentId: t.student_id, fullName: names.get(t.student_id)!, level: after });
      }
    }
  }
  const newBadges = delta > 0 ? await awardAutoBadges(db, cls.id, studentIds, now) : [];
  log("info", "points_given", { reqId: c.get("reqId"), classId: cls.id, delta, students: studentIds.length, withReason: reasonId !== undefined });
  const result: PointsResult = { events, batchId, newBadges, levelUps };
  return c.json(result, 201);
});

/** The history ("Lịch sử"), newest first. Filter by student; page with `before` (an event id). */
pointRoutes.get("/classes/:id/points", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const studentId = idParam(c.req.query("studentId"));
  const before = idParam(c.req.query("before"));
  const limit = Math.min(Math.max(Math.trunc(Number(c.req.query("limit") ?? 50)) || 50, 1), 200);
  const where = ["e.class_id = ?"];
  const binds: unknown[] = [cls.id];
  if (studentId !== null) {
    where.push("e.student_id = ?");
    binds.push(studentId);
  }
  if (before !== null) {
    where.push("e.id < ?");
    binds.push(before);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT e.*, s.full_name FROM point_events e JOIN students s ON s.id = e.student_id
     WHERE ${where.join(" AND ")} ORDER BY e.id DESC LIMIT ?`,
  )
    .bind(...binds, limit)
    .all<Record<string, unknown>>();
  return c.json(results.map(toPointEvent));
});

async function ownedEvent(c: Parameters<typeof ownedClass>[0], eid: number | null) {
  if (eid === null) return null;
  return c.env.DB.prepare(
    `SELECT e.*, s.full_name FROM point_events e JOIN classes c ON c.id = e.class_id JOIN students s ON s.id = e.student_id
     WHERE e.id = ? AND c.teacher_id = ?`,
  )
    .bind(eid, c.get("teacher").id)
    .first<Record<string, unknown>>();
}

/** "Thêm lý do": name the reason of a point already given. */
pointRoutes.patch("/points/:eid", async (c) => {
  const ev = await ownedEvent(c, idParam(c.req.param("eid")));
  if (!ev) return notFound(c, "Không tìm thấy lượt chấm điểm.");
  const body = await readJson(c, pointReasonPatch);
  if (!body.ok) return body.res;
  const reason = await ownedReason(c, body.data.reasonId);
  if (!reason || reason.class_id !== Number(ev.class_id)) return jsonError(c, 400, "invalid_input", "Lý do không thuộc lớp này.");
  await c.env.DB.prepare("UPDATE point_events SET reason = ?, emoji = ?, category = ? WHERE id = ?")
    .bind(reason.label, reason.emoji, reason.category, ev.id)
    .run();
  if (Number(ev.delta) > 0) await awardAutoBadges(c.env.DB, Number(ev.class_id), [Number(ev.student_id)], c.get("deps").now().toISOString());
  return c.json(toPointEvent({ ...ev, reason: reason.label, emoji: reason.emoji, category: reason.category }));
});

pointRoutes.delete("/points/:eid", async (c) => {
  const ev = await ownedEvent(c, idParam(c.req.param("eid")));
  if (!ev) return notFound(c, "Không tìm thấy lượt chấm điểm.");
  await c.env.DB.prepare("DELETE FROM point_events WHERE id = ?").bind(ev.id).run();
  return c.body(null, 204);
});

/** Undo one tap that scored several students at once. */
pointRoutes.delete("/classes/:id/points/batch/:batchId", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const res = await c.env.DB.prepare("DELETE FROM point_events WHERE class_id = ? AND batch_id = ?")
    .bind(cls.id, c.req.param("batchId"))
    .run();
  return c.json({ removed: res.meta.changes });
});
