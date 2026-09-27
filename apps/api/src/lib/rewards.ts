import type { Redemption, Reward } from "@lhhp/shared";

type Row = Record<string, unknown>;

export const toReward = (r: Row): Reward => ({
  id: Number(r.id),
  name: String(r.name),
  emoji: String(r.emoji),
  cost: Number(r.cost),
  active: Number(r.active) === 1,
});

export const toRedemption = (r: Row): Redemption => ({
  id: Number(r.id),
  studentId: Number(r.student_id),
  fullName: String(r.full_name ?? ""),
  rewardName: String(r.reward_name),
  emoji: String(r.emoji),
  cost: Number(r.cost),
  status: r.status as Redemption["status"],
  requestedAt: String(r.requested_at),
  decidedAt: (r.decided_at as string | null) ?? null,
});

/**
 * Records the teacher handing a reward over, only if the child still has the drops, in one statement: two
 * hand-overs sent together can't both spend the same drops. Returns null when there aren't enough.
 *
 * `pending` still counts against the balance so that a request left over from the old family-side shop keeps
 * holding its drops until she settles it. The drops come off what a child can spend; the plant is untouched.
 */
export async function insertRedemption(
  db: D1Database,
  r: { classId: number; studentId: number; reward: Row; now: string },
): Promise<Row | null> {
  return db
    .prepare(
      `INSERT INTO redemptions (class_id, student_id, reward_id, reward_name, emoji, cost, status, requested_at, decided_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'approved', ?7, ?7
       WHERE (SELECT COALESCE(SUM(delta), 0) FROM point_events WHERE student_id = ?2)
           - (SELECT COALESCE(SUM(cost), 0) FROM redemptions WHERE student_id = ?2 AND status IN ('approved', 'pending')) >= ?6
       RETURNING *`,
    )
    .bind(r.classId, r.studentId, r.reward.id, r.reward.name, r.reward.emoji, Number(r.reward.cost), r.now)
    .first<Row>();
}
