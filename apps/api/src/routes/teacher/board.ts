import { Hono, type Context } from "hono";
import {
  MAX_POST_PHOTOS,
  MAX_POSTS_PER_MONTH,
  boardMonthInput,
  boardQuery,
  commentInput,
  localDate,
  monthKey,
  postInput,
  postPatchInput,
  postPhotoInput,
  type PostLiker,
} from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { loadBoard, loadComments, postPhotoUrl, toPost } from "../../lib/board";
import { ownedClass } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { avatarUrl, decodeImage } from "../../lib/media";

/**
 * Bảng tin lớp học: a wall of tiles under the month's theme, the way a Padlet board works. Families read it from
 * their child's account, give a heart and write back.
 */
export const boardRoutes = new Hono<AppEnv>();

interface PostRow {
  id: number;
  class_id: number;
  month: string;
  photo_count: number;
}

/** The tile, if it is on a board of one of the signed-in teacher's classes. */
async function ownedPost(c: Context<AppEnv>, postId: number | null): Promise<PostRow | null> {
  if (postId === null) return null;
  return c.env.DB.prepare(
    "SELECT p.id, p.class_id, p.month, p.photo_count FROM posts p JOIN classes c ON c.id = p.class_id WHERE p.id = ? AND c.teacher_id = ?",
  )
    .bind(postId, c.get("teacher").id)
    .first<PostRow>();
}

boardRoutes.get("/classes/:id/board", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const q = boardQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Tháng không hợp lệ.");
  const month = q.data.month ?? monthKey(localDate(c.get("deps").now()));
  return c.json(await loadBoard(c.env.DB, cls.id, month, null));
});

/** The month's chủ điểm. One row a month, created the first time the teacher names it. */
boardRoutes.put("/classes/:id/board/:month", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const month = c.req.param("month");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return jsonError(c, 400, "invalid_query", "Tháng không hợp lệ.");
  const body = await readJson(c, boardMonthInput);
  if (!body.ok) return body.res;
  const now = c.get("deps").now().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO board_months (class_id, month, theme, note, emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (class_id, month) DO UPDATE SET theme = excluded.theme, note = excluded.note, emoji = excluded.emoji,
       updated_at = excluded.updated_at`,
  )
    .bind(cls.id, month, body.data.theme, body.data.note, body.data.emoji, now, now)
    .run();
  return c.json(await loadBoard(c.env.DB, cls.id, month, null));
});

boardRoutes.post("/classes/:id/posts", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, postInput);
  if (!body.ok) return body.res;
  const now = c.get("deps").now();
  const month = body.data.month ?? monthKey(localDate(now));
  const full = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM posts WHERE class_id = ? AND month = ?")
    .bind(cls.id, month)
    .first<{ n: number }>();
  if (Number(full?.n ?? 0) >= MAX_POSTS_PER_MONTH) {
    return jsonError(c, 400, "board_full", `Bảng tin tháng này đã có ${MAX_POSTS_PER_MONTH} ô. Xoá bớt rồi thêm tiếp nhé.`);
  }
  const iso = now.toISOString();
  const row = await c.env.DB.prepare(
    `INSERT INTO posts (class_id, month, kind, title, body, color, sticker, layout, pinned, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(
      cls.id,
      month,
      body.data.kind,
      body.data.title,
      body.data.body,
      body.data.color,
      body.data.sticker,
      body.data.layout,
      body.data.pinned ? 1 : 0,
      body.data.dueDate ?? null,
      iso,
      iso,
    )
    .first<Record<string, unknown>>();
  return c.json(toPost(row!, []), 201);
});

boardRoutes.patch("/posts/:pid", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  const body = await readJson(c, postPatchInput);
  if (!body.ok) return body.res;
  const d = body.data;
  const row = await c.env.DB.prepare(
    `UPDATE posts SET kind = COALESCE(?, kind), title = COALESCE(?, title), body = COALESCE(?, body),
       color = COALESCE(?, color), sticker = COALESCE(?, sticker), layout = COALESCE(?, layout),
       pinned = COALESCE(?, pinned), due_date = ?, updated_at = ?
     WHERE id = ? RETURNING *`,
  )
    .bind(
      d.kind ?? null,
      d.title ?? null,
      d.body ?? null,
      d.color ?? null,
      d.sticker ?? null,
      d.layout ?? null,
      d.pinned === undefined ? null : d.pinned ? 1 : 0,
      d.dueDate === undefined ? null : (d.dueDate ?? null),
      c.get("deps").now().toISOString(),
      post.id,
    )
    .first<Record<string, unknown>>();
  const { results } = await c.env.DB.prepare("SELECT id FROM post_photos WHERE post_id = ? ORDER BY position, id")
    .bind(post.id)
    .all<{ id: number }>();
  return c.json(toPost(row!, results.map((r) => postPhotoUrl(r.id))));
});

boardRoutes.delete("/posts/:pid", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(post.id).run();
  return c.body(null, 204);
});

/** A photo of the class, already resized in the browser. */
boardRoutes.post("/posts/:pid/photos", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  if (post.photo_count >= MAX_POST_PHOTOS) {
    return jsonError(c, 400, "too_many_photos", `Mỗi ô tối đa ${MAX_POST_PHOTOS} ảnh.`);
  }
  const body = await readJson(c, postPhotoInput);
  if (!body.ok) return body.res;
  const img = decodeImage(body.data.dataUrl, "post");
  if (typeof img === "string") return jsonError(c, 400, "invalid_image", img);
  const now = c.get("deps").now().toISOString();
  const [photo] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO post_photos (post_id, class_id, position, content_type, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(post.id, post.class_id, post.photo_count, img.contentType, img.base64, now),
    c.env.DB.prepare("UPDATE posts SET photo_count = photo_count + 1, updated_at = ? WHERE id = ?").bind(now, post.id),
  ]);
  const id = Number((photo!.results as { id: number }[])[0]!.id);
  return c.json({ id, url: postPhotoUrl(id) }, 201);
});

boardRoutes.delete("/posts/:pid/photos/:photoId", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  const photoId = idParam(c.req.param("photoId"));
  if (!post || photoId === null) return notFound(c, "Không tìm thấy ảnh.");
  const now = c.get("deps").now().toISOString();
  const [del] = await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM post_photos WHERE id = ? AND post_id = ?").bind(photoId, post.id),
    c.env.DB.prepare(
      "UPDATE posts SET photo_count = (SELECT COUNT(*) FROM post_photos WHERE post_id = ?), updated_at = ? WHERE id = ?",
    ).bind(post.id, now, post.id),
  ]);
  if (!del!.meta.changes) return notFound(c, "Không tìm thấy ảnh.");
  return c.body(null, 204);
});

/**
 * "Khi nhấn vào bài viết có thể xem được HS nào like" (brief 13). Hers to see: it names children, and a family has no
 * need to know which classmates hearted a tile.
 */
boardRoutes.get("/posts/:pid/likes", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.full_name, s.avatar_emoji, s.avatar_version, s.has_photo, l.created_at
     FROM post_likes l JOIN students s ON s.id = l.student_id
     WHERE l.post_id = ? ORDER BY l.created_at, l.rowid`,
  )
    .bind(post.id)
    .all<{ id: number; full_name: string; avatar_emoji: string; avatar_version: number; has_photo: number; created_at: string }>();
  const likers: PostLiker[] = results.map((r) => ({
    studentId: r.id,
    fullName: r.full_name,
    avatarEmoji: r.avatar_emoji,
    avatarUrl: avatarUrl(r.id, Number(r.avatar_version), Number(r.has_photo) === 1),
    likedAt: r.created_at,
  }));
  return c.json(likers);
});

boardRoutes.get("/posts/:pid/comments", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  return c.json(await loadComments(c.env.DB, post.id, { role: "teacher", id: c.get("teacher").id }));
});

boardRoutes.post("/posts/:pid/comments", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  const body = await readJson(c, commentInput);
  if (!body.ok) return body.res;
  await c.env.DB.prepare(
    "INSERT INTO post_comments (post_id, class_id, author, student_id, body, created_at) VALUES (?, ?, 'teacher', NULL, ?, ?)",
  )
    .bind(post.id, post.class_id, body.data.body, c.get("deps").now().toISOString())
    .run();
  // The whole thread comes back, the same shape the family's side gets, so one screen reads both.
  return c.json(await loadComments(c.env.DB, post.id, { role: "teacher", id: c.get("teacher").id }), 201);
});

/** The teacher moderates her own board: any comment on it can go. */
boardRoutes.delete("/posts/:pid/comments/:cid", async (c) => {
  const post = await ownedPost(c, idParam(c.req.param("pid")));
  const cid = idParam(c.req.param("cid"));
  if (!post || cid === null) return notFound(c, "Không tìm thấy bình luận.");
  const r = await c.env.DB.prepare("DELETE FROM post_comments WHERE id = ? AND post_id = ?").bind(cid, post.id).run();
  if (!r.meta.changes) return notFound(c, "Không tìm thấy bình luận.");
  return c.body(null, 204);
});
