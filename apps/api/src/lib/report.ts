import {
  POINT_CATEGORIES,
  SUBJECTS,
  currentSemester,
  localDate,
  monthPeriod,
  reportQuery,
  semesterPeriod,
  weekPeriod,
  yearPeriod,
  type ClassReport,
  type Period,
  type ReportData,
  type StudentReport,
} from "@lhhp/shared";
import type { ClassDetail } from "@lhhp/shared";
import { toPointEvent } from "./stats";

/** Reads ?period=week|month|semester|year&date=YYYY-MM-DD&semester=1|2 into a concrete period. */
export function resolvePeriod(query: Record<string, string>, cls: ClassDetail, now: Date): Period | string {
  const q = reportQuery.safeParse(query);
  if (!q.success) return "Khoảng thời gian không hợp lệ.";
  const date = q.data.date ?? localDate(now);
  if (q.data.period === "week") return weekPeriod(date);
  if (q.data.period === "month") return monthPeriod(date);
  if (q.data.period === "year") return yearPeriod(cls.semesters, cls.schoolYear);
  const which = q.data.semester ? (Number(q.data.semester) as 1 | 2) : currentSemester(cls.semesters, localDate(now));
  return semesterPeriod(cls.semesters, which, cls.schoolYear);
}

/**
 * Drops for a class, or for one student when `studentId` is given, plus how many tasks were set in each subject.
 * Everything is aggregated in SQL: a semester of a busy class is tens of thousands of point rows.
 */
export async function buildReport(db: D1Database, classId: number, period: Period, studentId: number | null): Promise<ReportData> {
  const scope = studentId === null ? "class_id = ?" : "class_id = ? AND student_id = ?";
  const scopeBinds = studentId === null ? [classId] : [classId, studentId];
  const range = [period.start, period.end];
  const bucketCase = `CASE ${period.buckets.map((_, i) => `WHEN created_at < ? THEN ${i}`).join(" ")} END`;
  const bucketEnds = period.buckets.map((b) => b.end);

  const [buckets, categories, reasons, subjects] = await db.batch([
    db
      .prepare(
        `SELECT ${bucketCase} AS b,
           COALESCE(SUM(CASE WHEN delta > 0 THEN delta END), 0) AS plus,
           COALESCE(SUM(CASE WHEN delta < 0 THEN -delta END), 0) AS minus
         FROM point_events WHERE ${scope} AND created_at >= ? AND created_at < ? GROUP BY b`,
      )
      .bind(...bucketEnds, ...scopeBinds, ...range),
    db
      .prepare(
        `SELECT category,
           COALESCE(SUM(CASE WHEN delta > 0 THEN delta END), 0) AS plus,
           COALESCE(SUM(CASE WHEN delta < 0 THEN -delta END), 0) AS minus,
           COALESCE(SUM(CASE WHEN delta > 0 AND category = 'yeu_thuong' THEN 1 END), 0) AS kind_count
         FROM point_events WHERE ${scope} AND created_at >= ? AND created_at < ? GROUP BY category`,
      )
      .bind(...scopeBinds, ...range),
    db
      .prepare(
        `SELECT reason, MAX(emoji) AS emoji, CASE WHEN delta > 0 THEN 'plus' ELSE 'minus' END AS kind,
           COUNT(*) AS count, SUM(delta) AS points
         FROM point_events WHERE ${scope} AND created_at >= ? AND created_at < ?
         GROUP BY reason, kind ORDER BY count DESC, points DESC LIMIT 8`,
      )
      .bind(...scopeBinds, ...range),
    db
      .prepare(
        `SELECT subject, COUNT(*) AS assigned FROM tasks
         WHERE class_id = ? AND status != 'draft' AND published_at >= ? AND published_at < ?
         GROUP BY subject`,
      )
      .bind(classId, ...range),
  ]);

  const byBucket = new Map((buckets!.results as { b: number; plus: number; minus: number }[]).map((r) => [Number(r.b), r]));
  const cats = categories!.results as { category: string; plus: number; minus: number; kind_count: number }[];
  const bySubject = new Map((subjects!.results as { subject: string; assigned: number }[]).map((r) => [r.subject, r]));

  const plus = cats.reduce((n, r) => n + Number(r.plus), 0);
  const minus = cats.reduce((n, r) => n + Number(r.minus), 0);
  return {
    period,
    totals: { plus, minus, net: plus - minus, kindness: cats.reduce((n, r) => n + Number(r.kind_count), 0) },
    buckets: period.buckets.map((b, i) => ({
      label: b.label,
      plus: Number(byBucket.get(i)?.plus ?? 0),
      minus: Number(byBucket.get(i)?.minus ?? 0),
    })),
    categories: POINT_CATEGORIES.map((category) => {
      const r = cats.find((x) => x.category === category);
      return { category, plus: Number(r?.plus ?? 0), minus: Number(r?.minus ?? 0) };
    }),
    reasons: (reasons!.results as Record<string, unknown>[]).map((r) => ({
      reason: String(r.reason),
      emoji: (r.emoji as string | null) ?? null,
      kind: r.kind as "plus" | "minus",
      count: Number(r.count),
      points: Number(r.points),
    })),
    subjects: SUBJECTS.map((subject) => ({ subject, assigned: Number(bySubject.get(subject)?.assigned ?? 0) })),
  };
}

export async function buildClassReport(db: D1Database, classId: number, period: Period): Promise<ClassReport> {
  const base = await buildReport(db, classId, period, null);
  const { results } = await db
    .prepare(
      `SELECT s.id, s.full_name, s.avatar_emoji, s.group_no,
         (SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta END), 0) FROM point_events e
            WHERE e.student_id = s.id AND e.created_at >= ?1 AND e.created_at < ?2) AS plus,
         (SELECT COALESCE(SUM(CASE WHEN delta < 0 THEN -delta END), 0) FROM point_events e
            WHERE e.student_id = s.id AND e.created_at >= ?1 AND e.created_at < ?2) AS minus
       FROM students s WHERE s.class_id = ?3 ORDER BY s.sort_order, s.id`,
    )
    .bind(period.start, period.end, classId)
    .all<Record<string, unknown>>();
  return {
    ...base,
    students: results.map((r) => ({
      id: Number(r.id),
      fullName: String(r.full_name),
      avatarEmoji: String(r.avatar_emoji),
      group: r.group_no === null ? null : Number(r.group_no),
      plus: Number(r.plus),
      minus: Number(r.minus),
      net: Number(r.plus) - Number(r.minus),
    })),
  };
}

export async function buildStudentReport(db: D1Database, classId: number, studentId: number, period: Period): Promise<StudentReport> {
  const base = await buildReport(db, classId, period, studentId);
  const { results } = await db
    .prepare(
      `SELECT e.*, s.full_name FROM point_events e JOIN students s ON s.id = e.student_id
       WHERE e.student_id = ? AND e.created_at >= ? AND e.created_at < ? ORDER BY e.created_at DESC, e.id DESC LIMIT 40`,
    )
    .bind(studentId, period.start, period.end)
    .all<Record<string, unknown>>();
  return { ...base, events: results.map(toPointEvent) };
}
