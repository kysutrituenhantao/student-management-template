import type { Context } from "hono";
import { BADGE_BY_KEY, type EarnedBadge, type TeacherNote } from "@lhhp/shared";
import type { AppEnv } from "../types";

export interface OwnedStudent {
  id: number;
  class_id: number;
  full_name: string;
  username: string;
  group_no: number | null;
  avatar_version: number;
}

/** The student, if they are in one of the signed-in teacher's classes. */
export async function ownedStudent(c: Context<AppEnv>, studentId: number | null): Promise<OwnedStudent | null> {
  if (studentId === null) return null;
  return c.env.DB.prepare(
    `SELECT s.id, s.class_id, s.full_name, s.username, s.group_no, s.avatar_version
     FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND c.teacher_id = ?`,
  )
    .bind(studentId, c.get("teacher").id)
    .first<OwnedStudent>();
}

/** A child's badges, in their class's words and icons (brief 12). */
export async function studentBadges(db: D1Database, studentId: number): Promise<EarnedBadge[]> {
  const { results } = await db
    .prepare(
      `SELECT b.badge_key, b.source, b.note, b.awarded_at, l.emoji, l.name, l.description
       FROM student_badges b JOIN students s ON s.id = b.student_id
       LEFT JOIN badge_labels l ON l.class_id = s.class_id AND l.badge_key = b.badge_key
       WHERE b.student_id = ? ORDER BY b.awarded_at DESC, b.id DESC`,
    )
    .bind(studentId)
    .all<{
      badge_key: string;
      source: "auto" | "teacher";
      note: string | null;
      awarded_at: string;
      emoji: string | null;
      name: string | null;
      description: string | null;
    }>();
  return results
    .filter((r) => BADGE_BY_KEY[r.badge_key])
    .map((r) => {
      const def = r.name ? { ...BADGE_BY_KEY[r.badge_key]!, emoji: r.emoji!, name: r.name, description: r.description ?? "" } : BADGE_BY_KEY[r.badge_key]!;
      return {
        key: def.key,
        name: def.name,
        emoji: def.emoji,
        description: def.description,
        source: r.source,
        note: r.note,
        awardedAt: r.awarded_at,
      };
    });
}

export async function studentNotes(db: D1Database, studentId: number, limit = 20): Promise<TeacherNote[]> {
  const { results } = await db
    .prepare("SELECT id, body, created_at FROM notes WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
    .bind(studentId, limit)
    .all<{ id: number; body: string; created_at: string }>();
  return results.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at }));
}

/** 1-based place in this week's class ranking, or null with no points this week. */
export async function weekRank(students: { id: number; weekPoints: number }[], studentId: number): Promise<number | null> {
  const me = students.find((s) => s.id === studentId);
  if (!me || me.weekPoints <= 0) return null;
  return students.filter((s) => s.weekPoints > me.weekPoints).length + 1;
}
