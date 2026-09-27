import { autoBadgeKeys, levelFor, weekPeriod, localDate, type PointEvent, type StudentRow } from "@lhhp/shared";
import { avatarUrl } from "./media";

type Row = Record<string, unknown>;

export function toStudentRow(r: Row): StudentRow {
  const drops = Number(r.drops ?? 0);
  return {
    id: Number(r.id),
    fullName: String(r.full_name),
    username: String(r.username),
    group: Number(r.group_no ?? 1),
    avatarEmoji: String(r.avatar_emoji),
    avatarUrl: avatarUrl(Number(r.id), Number(r.avatar_version ?? 0), Number(r.has_photo ?? 0) === 1),
    lastLoginAt: (r.last_login_at as string | null) ?? null,
    points: Number(r.points ?? 0),
    drops,
    weekPoints: Number(r.week_points ?? 0),
    level: levelFor(drops).level,
  };
}

const STUDENT_AGG = `
  SELECT s.id, s.full_name, s.username, s.group_no, s.avatar_emoji, s.avatar_version, s.has_photo,
         s.last_login_at, s.sort_order,
         COALESCE(SUM(e.delta), 0) AS points,
         COALESCE(SUM(CASE WHEN e.delta > 0 THEN e.delta END), 0) AS drops,
         COALESCE(SUM(CASE WHEN e.created_at >= ?1 AND e.created_at < ?2 THEN e.delta END), 0) AS week_points
  FROM students s LEFT JOIN point_events e ON e.student_id = s.id`;

/** Every student of a class with their totals, in class-list order. */
export async function classStudents(db: D1Database, classId: number, now: Date): Promise<StudentRow[]> {
  const w = weekPeriod(localDate(now));
  const { results } = await db
    .prepare(`${STUDENT_AGG} WHERE s.class_id = ?3 GROUP BY s.id ORDER BY s.sort_order, s.id`)
    .bind(w.start, w.end, classId)
    .all<Row>();
  return results.map(toStudentRow);
}

export async function studentRow(db: D1Database, studentId: number, now: Date): Promise<StudentRow | null> {
  const w = weekPeriod(localDate(now));
  const r = await db.prepare(`${STUDENT_AGG} WHERE s.id = ?3 GROUP BY s.id`).bind(w.start, w.end, studentId).first<Row>();
  return r ? toStudentRow(r) : null;
}

/**
 * Drops a child can still spend. The plant is not touched by this: `levelFor` counts drops *earned*, so a reward
 * costs the balance and never a stage — "nước mất đi k làm cây nhỏ lại" (brief 3, item 4).
 */
export async function availableDrops(db: D1Database, studentId: number): Promise<number> {
  const r = await db
    .prepare(
      `SELECT (SELECT COALESCE(SUM(delta), 0) FROM point_events WHERE student_id = ?1)
            - (SELECT COALESCE(SUM(cost), 0) FROM redemptions WHERE student_id = ?1 AND status IN ('approved', 'pending')) AS n`,
    )
    .bind(studentId)
    .first<{ n: number }>();
  return Math.max(0, Number(r?.n ?? 0));
}

export function toPointEvent(r: Row): PointEvent {
  return {
    id: Number(r.id),
    studentId: Number(r.student_id),
    studentName: String(r.full_name ?? ""),
    delta: Number(r.delta),
    reason: String(r.reason),
    emoji: (r.emoji as string | null) ?? null,
    category: r.category as PointEvent["category"],
    source: r.source as PointEvent["source"],
    batchId: (r.batch_id as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

/**
 * Awards any automatic badge a student now qualifies for. Returns the new ones, so the screen can celebrate them.
 * One query for the stats, one for the badges already held, one batch of inserts.
 */
export async function awardAutoBadges(
  db: D1Database,
  classId: number,
  studentIds: number[],
  nowIso: string,
): Promise<{ studentId: number; key: string }[]> {
  if (studentIds.length === 0) return [];
  const marks = studentIds.map(() => "?").join(",");
  const [stats, held] = await db.batch([
    db
      .prepare(
        `SELECT s.id,
           (SELECT COALESCE(SUM(delta), 0) FROM point_events WHERE student_id = s.id AND delta > 0) AS drops,
           (SELECT COUNT(*) FROM point_events WHERE student_id = s.id AND delta > 0 AND category = 'yeu_thuong') AS kindness
         FROM students s WHERE s.id IN (${marks})`,
      )
      .bind(...studentIds),
    db.prepare(`SELECT student_id, badge_key FROM student_badges WHERE student_id IN (${marks})`).bind(...studentIds),
  ]);
  const have = new Set((held!.results as Row[]).map((r) => `${r.student_id}:${r.badge_key}`));
  const fresh: { studentId: number; key: string }[] = [];
  for (const r of stats!.results as Row[]) {
    const keys = autoBadgeKeys({ drops: Number(r.drops), kindness: Number(r.kindness) });
    for (const key of keys) if (!have.has(`${r.id}:${key}`)) fresh.push({ studentId: Number(r.id), key });
  }
  if (fresh.length) {
    await db.batch(
      fresh.map((b) =>
        db
          .prepare("INSERT OR IGNORE INTO student_badges (class_id, student_id, badge_key, source, awarded_at) VALUES (?, ?, ?, 'auto', ?)")
          .bind(classId, b.studentId, b.key, nowIso),
      ),
    );
  }
  return fresh;
}
