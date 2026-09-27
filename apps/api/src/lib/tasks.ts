import type { Task } from "@lhhp/shared";

type Row = Record<string, unknown>;

/**
 * Giao việc. The teacher writes what the class is to do; the family reads it. Nothing comes back, so a task row is
 * the same on both sides and the instructions travel with the list — that text is what a parent opens the app for.
 */
export const TASK_SELECT = `SELECT t.id, t.subject, t.title, t.instructions, t.status, t.due_date, t.created_at, t.published_at
  FROM tasks t`;

export function toTask(r: Row): Task {
  return {
    id: Number(r.id),
    subject: r.subject as Task["subject"],
    title: String(r.title),
    instructions: String(r.instructions ?? ""),
    status: r.status as Task["status"],
    dueDate: (r.due_date as string | null) ?? null,
    createdAt: String(r.created_at),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}
