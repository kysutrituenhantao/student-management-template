import {
  ATTENDANCE_EMOJI,
  ATTENDANCE_INFO,
  ATTENDANCE_REASON,
  type AttendanceCount,
  type AttendanceMark,
  type AttendanceStatus,
  type AttendanceView,
  type Period,
  type StudentAttendance,
} from "@lhhp/shared";
import { avatarUrl } from "./media";

type Row = Record<string, unknown>;

/** All the drops a day's register gave share this batch, one per child, so taking it twice changes nothing. */
export const attendanceBatch = (day: string) => `chuyen-can:${day}`;

export function toMark(r: Row): AttendanceMark {
  return { studentId: Number(r.student_id), status: r.status as AttendanceStatus, note: String(r.note ?? "") };
}

const COUNTS = `
  SELECT s.id, s.full_name, s.avatar_emoji, s.avatar_version, s.has_photo, s.group_no,
         COALESCE(SUM(CASE WHEN a.status = 'co_mat' THEN 1 END), 0)     AS co_mat,
         COALESCE(SUM(CASE WHEN a.status = 'di_muon' THEN 1 END), 0)    AS di_muon,
         COALESCE(SUM(CASE WHEN a.status = 'co_phep' THEN 1 END), 0)    AS co_phep,
         COALESCE(SUM(CASE WHEN a.status = 'khong_phep' THEN 1 END), 0) AS khong_phep
  FROM students s
  LEFT JOIN attendance a ON a.student_id = s.id AND a.day >= ?2 AND a.day <= ?3
  WHERE s.class_id = ?1 GROUP BY s.id ORDER BY s.sort_order, s.id`;

export function toCount(r: Row): AttendanceCount {
  return {
    studentId: Number(r.id),
    fullName: String(r.full_name),
    avatarEmoji: String(r.avatar_emoji),
    avatarUrl: avatarUrl(Number(r.id), Number(r.avatar_version ?? 0), Number(r.has_photo ?? 0) === 1),
    group: r.group_no === null || r.group_no === undefined ? null : Number(r.group_no),
    coMat: Number(r.co_mat),
    diMuon: Number(r.di_muon),
    coPhep: Number(r.co_phep),
    khongPhep: Number(r.khong_phep),
  };
}

/** One day's register, plus how the whole period has gone for every child. */
export async function loadAttendance(db: D1Database, classId: number, day: string, period: Period): Promise<AttendanceView> {
  const [marks, counts, days] = await db.batch([
    db.prepare("SELECT student_id, status, note FROM attendance WHERE class_id = ? AND day = ?").bind(classId, day),
    db.prepare(COUNTS).bind(classId, period.startDate, period.endDate),
    db
      .prepare("SELECT COUNT(DISTINCT day) AS n FROM attendance WHERE class_id = ? AND day >= ? AND day <= ?")
      .bind(classId, period.startDate, period.endDate),
  ]);
  return {
    day,
    marks: (marks!.results as Row[]).map(toMark),
    period: { kind: period.kind, label: period.label, startDate: period.startDate, endDate: period.endDate },
    counts: (counts!.results as Row[]).map(toCount),
    daysTaken: Number((days!.results as Row[])[0]?.n ?? 0),
  };
}

export async function loadStudentAttendance(
  db: D1Database,
  classId: number,
  studentId: number,
  period: Period,
): Promise<StudentAttendance> {
  const [counts, days, recent] = await db.batch([
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'co_mat' THEN 1 END), 0)     AS co_mat,
                COALESCE(SUM(CASE WHEN status = 'di_muon' THEN 1 END), 0)    AS di_muon,
                COALESCE(SUM(CASE WHEN status = 'co_phep' THEN 1 END), 0)    AS co_phep,
                COALESCE(SUM(CASE WHEN status = 'khong_phep' THEN 1 END), 0) AS khong_phep
         FROM attendance WHERE student_id = ? AND day >= ? AND day <= ?`,
      )
      .bind(studentId, period.startDate, period.endDate),
    db
      .prepare("SELECT COUNT(DISTINCT day) AS n FROM attendance WHERE class_id = ? AND day >= ? AND day <= ?")
      .bind(classId, period.startDate, period.endDate),
    db
      .prepare("SELECT day, status, note FROM attendance WHERE student_id = ? ORDER BY day DESC LIMIT 30")
      .bind(studentId),
  ]);
  const c = (counts!.results as Row[])[0] ?? {};
  return {
    period: { kind: period.kind, label: period.label },
    coMat: Number(c.co_mat ?? 0),
    diMuon: Number(c.di_muon ?? 0),
    coPhep: Number(c.co_phep ?? 0),
    khongPhep: Number(c.khong_phep ?? 0),
    daysTaken: Number((days!.results as Row[])[0]?.n ?? 0),
    recent: (recent!.results as Row[]).map((r) => ({
      day: String(r.day),
      status: r.status as AttendanceStatus,
      note: String(r.note ?? ""),
    })),
  };
}

/**
 * Writes a day's register. A child who was at school gets their daily drop; one who is marked absent after being
 * marked present gives it back. The unique index on the batch is what keeps it to one drop a day, however many
 * times the register is taken or however many devices take it at once.
 */
export function registerStatements(
  db: D1Database,
  classId: number,
  day: string,
  marks: { studentId: number; status: AttendanceStatus; note?: string }[],
  nowIso: string,
): D1PreparedStatement[] {
  const batch = attendanceBatch(day);
  const out: D1PreparedStatement[] = [];
  for (const m of marks) {
    out.push(
      db
        .prepare(
          `INSERT INTO attendance (class_id, student_id, day, status, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (class_id, student_id, day) DO UPDATE SET status = excluded.status, note = excluded.note,
             updated_at = excluded.updated_at`,
        )
        .bind(classId, m.studentId, day, m.status, m.note ?? "", nowIso, nowIso),
    );
    if (ATTENDANCE_INFO[m.status].drop) {
      out.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO point_events (class_id, student_id, delta, category, reason, emoji, source, batch_id, created_at)
             VALUES (?, ?, 1, 'ren_luyen', ?, ?, 'manual', ?, ?)`,
          )
          .bind(classId, m.studentId, ATTENDANCE_REASON, ATTENDANCE_EMOJI, batch, nowIso),
      );
    } else {
      out.push(db.prepare("DELETE FROM point_events WHERE student_id = ? AND batch_id = ?").bind(m.studentId, batch));
    }
  }
  return out;
}
