import type { StudentWork } from "@lhhp/shared";

/**
 * "Sản phẩm của em". The URL carries no version because a piece of work is never edited: a new photo is a new row
 * with a new id, and taking one down removes it for good.
 */
export const workUrl = (id: number) => `/api/media/work/${id}`;

export const toWork = (r: Record<string, unknown>): StudentWork => ({
  id: Number(r.id),
  title: String(r.title ?? ""),
  url: workUrl(Number(r.id)),
  createdAt: String(r.created_at),
});

export const WORK_SELECT = "SELECT id, title, created_at FROM student_works";
