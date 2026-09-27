import {
  MONTH_THEMES,
  monthLabel,
  type BoardMonth,
  type BoardView,
  type Post,
  type PostComment,
} from "@lhhp/shared";
import { avatarUrl } from "./media";

type Row = Record<string, unknown>;

/** Photos are versioned by their own id: a new photo is a new row and so a new URL. */
export const postPhotoUrl = (photoId: number) => `/api/media/post/${photoId}`;

export function toBoardMonth(month: string, r: Row | null): BoardMonth {
  const suggested = MONTH_THEMES[Number(month.slice(5, 7))] ?? "";
  return {
    month,
    label: monthLabel(month),
    theme: r ? String(r.theme) : suggested,
    note: r ? String(r.note) : "",
    emoji: r ? String(r.emoji) : "🌼",
  };
}

export function toPost(r: Row, photos: string[]): Post {
  return {
    id: Number(r.id),
    month: String(r.month),
    kind: r.kind as Post["kind"],
    title: String(r.title),
    body: String(r.body),
    color: r.color as Post["color"],
    sticker: String(r.sticker ?? ""),
    layout: (r.layout as Post["layout"]) ?? "ghim",
    pinned: Number(r.pinned) === 1,
    dueDate: (r.due_date as string | null) ?? null,
    photos,
    likes: Number(r.likes ?? 0),
    likedByMe: Number(r.liked ?? 0) > 0,
    comments: Number(r.comments ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function toComment(r: Row, mine: boolean): PostComment {
  const isTeacher = r.author === "teacher";
  return {
    id: Number(r.id),
    author: isTeacher ? "teacher" : "family",
    studentId: r.student_id === null || r.student_id === undefined ? null : Number(r.student_id),
    authorName: isTeacher ? String(r.teacher_name ?? "Cô giáo") : `Phụ huynh ${String(r.full_name ?? "")}`.trim(),
    avatarEmoji: isTeacher ? null : ((r.avatar_emoji as string | null) ?? null),
    avatarUrl: isTeacher ? null : avatarUrl(Number(r.student_id), Number(r.avatar_version ?? 0), Number(r.has_photo ?? 0) === 1),
    body: String(r.body),
    createdAt: String(r.created_at),
    mine,
  };
}

/**
 * One month of the board. `studentId` marks the hearts that family already gave; the teacher passes null.
 * Photos come back as URLs only, so reading a board never reads image bytes.
 */
export async function loadBoard(db: D1Database, classId: number, month: string, studentId: number | null): Promise<BoardView> {
  const [theme, months, posts, photos] = await db.batch([
    db.prepare("SELECT * FROM board_months WHERE class_id = ? AND month = ?").bind(classId, month),
    db
      .prepare(
        `SELECT month FROM (SELECT month FROM posts WHERE class_id = ?1 UNION SELECT month FROM board_months WHERE class_id = ?1)
         ORDER BY month DESC LIMIT 24`,
      )
      .bind(classId),
    db
      .prepare(
        `SELECT p.*,
           (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
           (SELECT COUNT(*) FROM post_comments k WHERE k.post_id = p.id) AS comments,
           (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id AND l.student_id = ?3) AS liked
         FROM posts p WHERE p.class_id = ?1 AND p.month = ?2
         ORDER BY p.pinned DESC, p.created_at DESC, p.id DESC LIMIT 200`,
      )
      .bind(classId, month, studentId ?? 0),
    db
      .prepare(
        `SELECT id, post_id FROM post_photos WHERE post_id IN (SELECT id FROM posts WHERE class_id = ? AND month = ?)
         ORDER BY position, id`,
      )
      .bind(classId, month),
  ]);
  const byPost = new Map<number, string[]>();
  for (const r of photos!.results as Row[]) {
    const list = byPost.get(Number(r.post_id)) ?? [];
    list.push(postPhotoUrl(Number(r.id)));
    byPost.set(Number(r.post_id), list);
  }
  const monthRow = (theme!.results as Row[])[0] ?? null;
  const list = (months!.results as Row[]).map((r) => String(r.month));
  return {
    month: toBoardMonth(month, monthRow),
    months: list.includes(month) ? list : [month, ...list].sort().reverse(),
    posts: (posts!.results as Row[]).map((r) => toPost(r, byPost.get(Number(r.id)) ?? [])),
  };
}

const COMMENT_SELECT = `SELECT k.*, s.full_name, s.avatar_emoji, s.avatar_version, s.has_photo, t.display_name AS teacher_name
  FROM post_comments k
  LEFT JOIN students s ON s.id = k.student_id
  JOIN posts p ON p.id = k.post_id
  JOIN classes c ON c.id = p.class_id
  JOIN teachers t ON t.id = c.teacher_id`;

export async function loadComments(db: D1Database, postId: number, me: { role: "teacher" | "student"; id: number }): Promise<PostComment[]> {
  const { results } = await db
    .prepare(`${COMMENT_SELECT} WHERE k.post_id = ? ORDER BY k.created_at, k.id LIMIT 200`)
    .bind(postId)
    .all<Row>();
  return results.map((r) =>
    toComment(r, me.role === "teacher" ? r.author === "teacher" : r.author === "family" && Number(r.student_id) === me.id),
  );
}
