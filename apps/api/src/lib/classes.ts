import type { Context } from "hono";
import { DEFAULT_TEAMS, type ClassDetail, type Team } from "@lhhp/shared";
import type { AppEnv } from "../types";
import { coverUrl } from "./media";

export interface ClassRow {
  id: number;
  teacher_id: number;
  name: string;
  grade: number;
  school_year: string;
  motto: string;
  group_count: number;
  show_leaderboard: number;
  hk1_start: string;
  hk1_end: string;
  hk2_start: string;
  hk2_end: string;
  teams: string;
  seating: string;
  cover_shade: number;
  cover_version: number;
  teacher_name?: string;
  student_count?: number;
}

const CLASS_SELECT = `SELECT c.*, t.display_name AS teacher_name,
  (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count
  FROM classes c JOIN teachers t ON t.id = c.teacher_id`;

/** The class, if it belongs to the signed-in teacher. Anything else reads as "not found". */
export async function ownedClass(c: Context<AppEnv>, classId: number | null): Promise<ClassRow | null> {
  if (classId === null) return null;
  return c.env.DB.prepare(`${CLASS_SELECT} WHERE c.id = ? AND c.teacher_id = ?`)
    .bind(classId, c.get("teacher").id)
    .first<ClassRow>();
}

export async function classById(c: Context<AppEnv>, classId: number): Promise<ClassRow | null> {
  return c.env.DB.prepare(`${CLASS_SELECT} WHERE c.id = ?`).bind(classId).first<ClassRow>();
}

export async function teacherClasses(c: Context<AppEnv>): Promise<ClassRow[]> {
  const { results } = await c.env.DB.prepare(`${CLASS_SELECT} WHERE c.teacher_id = ? ORDER BY c.created_at DESC`)
    .bind(c.get("teacher").id)
    .all<ClassRow>();
  return results;
}

function parseTeams(raw: string, count: number): Team[] {
  let saved: Partial<Team>[] = [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) saved = v;
  } catch {
    saved = [];
  }
  return Array.from({ length: count }, (_, i) => {
    const d = DEFAULT_TEAMS[i % DEFAULT_TEAMS.length]!;
    const s = saved[i] ?? {};
    return {
      name: typeof s.name === "string" && s.name ? s.name : d.name,
      emoji: typeof s.emoji === "string" && s.emoji ? s.emoji : d.emoji,
      leaderId: typeof s.leaderId === "number" ? s.leaderId : null,
      deputyId: typeof s.deputyId === "number" ? s.deputyId : null,
    };
  });
}

const DAY_MS = 86_400_000;
const days = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS;

/** Semester I before semester II, each no longer than a school semester (about 20 weeks, allowing some slack). */
export function semestersProblem(sem: { hk1Start: string; hk1End: string; hk2Start: string; hk2End: string }): string | null {
  if (!(sem.hk1Start < sem.hk1End && sem.hk1End < sem.hk2Start && sem.hk2Start < sem.hk2End)) {
    return "Ngày học kỳ chưa hợp lý: học kỳ I phải kết thúc trước học kỳ II.";
  }
  if (days(sem.hk1Start, sem.hk1End) > 200 || days(sem.hk2Start, sem.hk2End) > 200 || days(sem.hk1End, sem.hk2Start) > 60) {
    return "Ngày học kỳ chưa hợp lý: mỗi học kỳ dài tối đa khoảng 6 tháng.";
  }
  return null;
}

export function toClassDetail(r: ClassRow): ClassDetail {
  return {
    id: r.id,
    name: r.name,
    grade: r.grade,
    schoolYear: r.school_year,
    motto: r.motto,
    studentCount: Number(r.student_count ?? 0),
    coverUrl: coverUrl(r.id, r.cover_version),
    groupCount: r.group_count,
    showLeaderboard: r.show_leaderboard === 1,
    semesters: { hk1Start: r.hk1_start, hk1End: r.hk1_end, hk2Start: r.hk2_start, hk2End: r.hk2_end },
    teacherName: String(r.teacher_name ?? ""),
    teams: parseTeams(r.teams, r.group_count),
    coverShade: Number(r.cover_shade),
  };
}
