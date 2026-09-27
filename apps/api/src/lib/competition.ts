import {
  BADGES,
  monthPeriod,
  schoolWeekOf,
  type BadgeDef,
  type CompetitionEntry,
  type CompetitionPeriod,
  type Period,
  type SchoolRanking,
  type Semesters,
} from "@lhhp/shared";

/**
 * A period's name: a week by her school-week name, "Tuần 3 (21/09 – 25/09)" (brief 18), a month as "Tháng 9/2026".
 * A week outside the school year keeps its calendar name.
 */
export function competitionLabel(kind: CompetitionPeriod, periodKey: string, sem: Semesters): string {
  if (kind === "month") return monthPeriod(periodKey).label;
  return schoolWeekOf(sem, periodKey)?.label ?? weekFallback(periodKey);
}
const weekFallback = (monday: string) => `Tuần ${monday.slice(8, 10)}/${monday.slice(5, 7)}`;

/** The weeks and months she has entered results for, newest first — all a family is ever shown (brief 18). */
export async function enteredPeriods(db: D1Database, classId: number, sem: Semesters): Promise<CompetitionEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT c.period, c.period_key FROM competition_results c
       WHERE c.class_id = ? AND EXISTS (SELECT 1 FROM competition_rows r WHERE r.result_id = c.id)
       ORDER BY c.period_key DESC, c.period = 'month'`,
    )
    .bind(classId)
    .all<{ period: CompetitionPeriod; period_key: string }>();
  return results.map((r) => ({ period: r.period, periodKey: r.period_key, periodLabel: competitionLabel(r.period, r.period_key, sem) }));
}

/**
 * Kết quả thi đua (brief 12): the school's results for one week or month of one of her classes, highest score first.
 * Ties keep the order she typed them in.
 */
export async function loadRanking(
  db: D1Database,
  classId: number,
  kind: CompetitionPeriod,
  period: Period,
  sem: Semesters,
): Promise<SchoolRanking> {
  const { results } = await db
    .prepare(
      `SELECT r.name, r.score, r.is_ours FROM competition_rows r
       JOIN competition_results c ON c.id = r.result_id
       WHERE c.class_id = ? AND c.period = ? AND c.period_key = ?
       ORDER BY r.score DESC, r.seq`,
    )
    .bind(classId, kind, period.startDate)
    .all<{ name: string; score: number; is_ours: number }>();
  return {
    period: kind,
    periodKey: period.startDate,
    periodLabel: competitionLabel(kind, period.startDate, sem),
    rows: results.map((r) => ({ name: r.name, score: Number(r.score), isOurs: Number(r.is_ours) === 1 })),
  };
}

/** The classes of the last results she entered before this period, in their order then: next week starts from them. */
export async function lastNames(db: D1Database, classId: number, kind: CompetitionPeriod, before: string) {
  const { results } = await db
    .prepare(
      `SELECT r.name, r.is_ours FROM competition_rows r
       WHERE r.result_id = (SELECT id FROM competition_results WHERE class_id = ? AND period = ? AND period_key < ?
                            ORDER BY period_key DESC LIMIT 1)
       ORDER BY r.score DESC, r.seq`,
    )
    .bind(classId, kind, before)
    .all<{ name: string; is_ours: number }>();
  return results.map((r) => ({ name: r.name, isOurs: Number(r.is_ours) === 1 }));
}

/** Two decimals are all a school's emulation score ever has; a float's tail is not a score. */
export const roundScore = (n: number) => Math.round(n * 100) / 100;

/**
 * Every badge as one class shows it (brief 12: "Icon huy hiệu và nội dung Huy hiệu GV có thể chỉnh sửa"). Her words
 * and icon where she changed them, the app's own otherwise; the key, and whether the app awards it, never change.
 */
export async function classBadgeDefs(db: D1Database, classId: number): Promise<BadgeDef[]> {
  const { results } = await db
    .prepare("SELECT badge_key, emoji, name, description FROM badge_labels WHERE class_id = ?")
    .bind(classId)
    .all<{ badge_key: string; emoji: string; name: string; description: string }>();
  const mine = new Map(results.map((r) => [r.badge_key, r]));
  return BADGES.map((b) => {
    const m = mine.get(b.key);
    return m ? { ...b, emoji: m.emoji, name: m.name, description: m.description } : b;
  });
}
