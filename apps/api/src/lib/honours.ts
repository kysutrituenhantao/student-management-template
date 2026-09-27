import {
  HONOUR_INFO,
  currentSemester,
  localDate,
  monthPeriod,
  semesterPeriod,
  weekPeriod,
  yearPeriod,
  type ClassDetail,
  type Honour,
  type HonourPeriod,
  type Period,
} from "@lhhp/shared";
import { avatarUrl } from "./media";

type Row = Record<string, unknown>;

/** The stretch of time an honour is for. Its first local date is the key, so a week can only be crowned once. */
export function honourPeriod(kind: HonourPeriod, cls: ClassDetail, now: Date, date?: string, semester?: "1" | "2"): Period {
  const d = date ?? localDate(now);
  if (kind === "week") return weekPeriod(d);
  if (kind === "month") return monthPeriod(d);
  if (kind === "year") return yearPeriod(cls.semesters, cls.schoolYear);
  const which = semester ? (Number(semester) as 1 | 2) : currentSemester(cls.semesters, localDate(now));
  return semesterPeriod(cls.semesters, which, cls.schoolYear);
}

export function toHonour(r: Row): Honour {
  return {
    id: Number(r.id),
    studentId: Number(r.student_id),
    fullName: String(r.full_name),
    avatarEmoji: String(r.avatar_emoji ?? "🐰"),
    avatarUrl: avatarUrl(Number(r.student_id), Number(r.avatar_version ?? 0), Number(r.has_photo ?? 0) === 1),
    period: r.period as HonourPeriod,
    periodKey: String(r.period_key),
    periodLabel: String(r.period_label),
    title: String(r.title),
    note: String(r.note ?? ""),
    points: Number(r.points ?? 0),
    createdAt: String(r.created_at),
  };
}

export const HONOUR_SELECT = `SELECT h.*, s.full_name, s.avatar_emoji, s.avatar_version, s.has_photo
  FROM honours h JOIN students s ON s.id = h.student_id`;

export const defaultHonourTitle = (kind: HonourPeriod) => HONOUR_INFO[kind].title;

/** Who earned the most drops over the period — the ranking the teacher crowns from. */
export async function periodLeaders(db: D1Database, classId: number, period: Period, limit = 10) {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.full_name, s.avatar_emoji, s.avatar_version, s.has_photo, s.group_no,
              COALESCE(SUM(CASE WHEN e.created_at >= ?2 AND e.created_at < ?3 THEN e.delta END), 0) AS points
       FROM students s LEFT JOIN point_events e ON e.student_id = s.id
       WHERE s.class_id = ?1 GROUP BY s.id
       HAVING points > 0
       ORDER BY points DESC, s.full_name LIMIT ?4`,
    )
    .bind(classId, period.start, period.end, limit)
    .all<Row>();
  return results.map((r) => ({
    studentId: Number(r.id),
    fullName: String(r.full_name),
    avatarEmoji: String(r.avatar_emoji),
    avatarUrl: avatarUrl(Number(r.id), Number(r.avatar_version ?? 0), Number(r.has_photo ?? 0) === 1),
    group: r.group_no === null || r.group_no === undefined ? null : Number(r.group_no),
    points: Number(r.points),
  }));
}
