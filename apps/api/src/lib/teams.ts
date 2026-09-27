import type { Period, TeamRace, TeamStanding, Team } from "@lhhp/shared";

type Row = Record<string, unknown>;

/**
 * Thi đua theo tổ over a period. Counted in SQL from the point rows, so a week, a month and the whole school year
 * are the same query. A tổ with more children would win on the total alone, so the average rides along.
 */
export async function teamRace(db: D1Database, classId: number, teams: Team[], period: Period): Promise<TeamRace> {
  const { results } = await db
    .prepare(
      `SELECT s.group_no,
              COUNT(DISTINCT s.id) AS members,
              COALESCE(SUM(CASE WHEN e.delta > 0 THEN e.delta END), 0)  AS plus,
              COALESCE(SUM(CASE WHEN e.delta < 0 THEN -e.delta END), 0) AS minus
       FROM students s
       LEFT JOIN point_events e ON e.student_id = s.id AND e.created_at >= ?2 AND e.created_at < ?3
       WHERE s.class_id = ?1 AND s.group_no IS NOT NULL
       GROUP BY s.group_no`,
    )
    .bind(classId, period.start, period.end)
    .all<Row>();
  const by = new Map(results.map((r) => [Number(r.group_no), r]));
  const standings: TeamStanding[] = teams.map((t, i) => {
    const r = by.get(i + 1);
    const members = Number(r?.members ?? 0);
    const plus = Number(r?.plus ?? 0);
    const minus = Number(r?.minus ?? 0);
    const points = plus - minus;
    return {
      group: i + 1,
      name: t.name,
      emoji: t.emoji,
      members,
      plus,
      minus,
      points,
      average: members ? Math.round((points / members) * 10) / 10 : 0,
    };
  });
  standings.sort((a, b) => b.points - a.points || b.average - a.average || a.group - b.group);
  return {
    period: { kind: period.kind, label: period.label, startDate: period.startDate, endDate: period.endDate },
    standings,
  };
}
