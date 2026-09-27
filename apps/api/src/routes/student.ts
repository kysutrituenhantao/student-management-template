import { Hono, type Context } from "hono";
import {
  MAX_STUDENTS_PER_CLASS,
  avatarEmojiInput,
  boardQuery,
  commentInput,
  imageInput,
  levelFor,
  localDate,
  messageInput,
  monthKey,
  myProfileInput,
  schoolWeek,
  competitionQuery,
  honourQuery,
  type FamilyHonourBoard,
  type StudentHome,
} from "@lhhp/shared";
import type { AppEnv } from "../types";
import { studentMe } from "./auth";
import { loadStudentAttendance } from "../lib/attendance";
import { loadBoard, loadComments } from "../lib/board";
import { HONOUR_SELECT, honourPeriod, periodLeaders, toHonour } from "../lib/honours";
import { classBadgeDefs, enteredPeriods, loadRanking } from "../lib/competition";
import { MANG_NON_SELECT, hideBirthYear, toMangNonRow } from "../lib/profiles";
import { idParam, readJson } from "../lib/body";
import { classById, toClassDetail } from "../lib/classes";
import { toAnnouncement, toMessage } from "../lib/comms";
import { jsonError, notFound } from "../lib/errors";
import { log } from "../lib/log";
import { decodeImage } from "../lib/media";
import { buildStudentReport, resolvePeriod } from "../lib/report";
import { loadStudent, requireStudent } from "../lib/session";
import { availableDrops, classStudents, toPointEvent } from "../lib/stats";
import { studentBadges, studentNotes, weekRank } from "../lib/students";
import { WORK_SELECT, toWork } from "../lib/works";
import { TASK_SELECT, toTask } from "../lib/tasks";

/** The student and family area. Everything is scoped to the signed-in child's own account and class. */
export const studentRoutes = new Hono<AppEnv>();
studentRoutes.use("*", requireStudent);

studentRoutes.get("/home", async (c) => {
  const me = c.get("student");
  const db = c.env.DB;
  const now = c.get("deps").now();
  const today = localDate(now);
  const cls = toClassDetail((await classById(c, me.classId))!);
  const students = await classStudents(db, me.classId, now);
  const row = students.find((s) => s.id === me.id)!;
  const [available, badges, notes, batch] = await Promise.all([
    availableDrops(db, me.id),
    studentBadges(db, me.id),
    studentNotes(db, me.id, 5),
    db.batch([
      db
        .prepare(`${TASK_SELECT} WHERE t.class_id = ?1 AND t.status = 'published' AND (t.due_date IS NULL OR t.due_date >= ?2)
                  ORDER BY t.due_date IS NULL, t.due_date, t.published_at DESC LIMIT 20`)
        .bind(me.classId, today),
      db.prepare("SELECT * FROM announcements WHERE class_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 5").bind(me.classId),
      db
        .prepare(`SELECT e.*, s.full_name FROM point_events e JOIN students s ON s.id = e.student_id
                  WHERE e.student_id = ? ORDER BY e.created_at DESC, e.id DESC LIMIT 8`)
        .bind(me.id),
      db.prepare("SELECT COUNT(*) AS n FROM messages WHERE student_id = ? AND sender = 'teacher' AND read_at IS NULL").bind(me.id),
    ]),
  ]);
  const [tasks, announcements, recent, unread] = batch;
  const weekTop = cls.showLeaderboard
    ? students
        .filter((s) => s.weekPoints > 0)
        .sort((a, b) => b.weekPoints - a.weekPoints || a.fullName.localeCompare(b.fullName, "vi"))
        .slice(0, 10)
        .map((s) => ({ studentId: s.id, fullName: s.fullName, avatarEmoji: s.avatarEmoji, avatarUrl: s.avatarUrl, group: s.group, points: s.weekPoints }))
    : null;
  const body: StudentHome = {
    me: studentMe(me) as StudentHome["me"],
    profile: {
      student: row,
      level: levelFor(row.drops),
      available,
      badges,
      notes,
      // With the Top 10 hidden, a family sees nothing about where their child stands among the others.
      rank: cls.showLeaderboard ? await weekRank(students, me.id) : null,
    },
    className: cls.name,
    classMotto: cls.motto,
    coverUrl: cls.coverUrl,
    teacherName: cls.teacherName,
    openTasks: (tasks!.results as Record<string, unknown>[]).map(toTask),
    announcements: (announcements!.results as Record<string, unknown>[]).map(toAnnouncement),
    recent: (recent!.results as Record<string, unknown>[]).map(toPointEvent),
    weekTop,
    unreadMessages: Number((unread!.results[0] as { n: number }).n),
    schoolWeek: schoolWeek(cls.semesters, today),
  };
  return c.json(body);
});

/** Everything the teacher has set, newest first. There is nothing to open: the whole notice is in the row. */
studentRoutes.get("/tasks", async (c) => {
  const me = c.get("student");
  const { results } = await c.env.DB.prepare(
    `${TASK_SELECT} WHERE t.class_id = ? AND t.status != 'draft' ORDER BY t.published_at DESC, t.id DESC LIMIT 200`,
  )
    .bind(me.classId)
    .all<Record<string, unknown>>();
  return c.json(results.map(toTask));
});

studentRoutes.get("/report", async (c) => {
  const me = c.get("student");
  const cls = toClassDetail((await classById(c, me.classId))!);
  const period = resolvePeriod(c.req.query(), cls, c.get("deps").now());
  if (typeof period === "string") return jsonError(c, 400, "invalid_query", period);
  return c.json(await buildStudentReport(c.env.DB, me.classId, me.id, period));
});

studentRoutes.get("/points", async (c) => {
  const me = c.get("student");
  const before = idParam(c.req.query("before"));
  const { results } = await c.env.DB.prepare(
    `SELECT e.*, s.full_name FROM point_events e JOIN students s ON s.id = e.student_id
     WHERE e.student_id = ? ${before !== null ? "AND e.id < ?" : ""} ORDER BY e.id DESC LIMIT 50`,
  )
    .bind(...(before !== null ? [me.id, before] : [me.id]))
    .all<Record<string, unknown>>();
  return c.json(results.map(toPointEvent));
});

studentRoutes.get("/badges", async (c) => {
  const me = c.get("student");
  const [all, earned] = await Promise.all([classBadgeDefs(c.env.DB, me.classId), studentBadges(c.env.DB, me.id)]);
  return c.json({ all, earned });
});

/** Kết quả thi đua (brief 12): the school's results for the child's own class, as the teacher entered them. */
studentRoutes.get("/competition", async (c) => {
  const me = c.get("student");
  const q = competitionQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Khoảng thời gian không hợp lệ.");
  const cls = toClassDetail((await classById(c, me.classId))!);
  const period = honourPeriod(q.data.period, cls, c.get("deps").now(), q.data.date);
  return c.json(await loadRanking(c.env.DB, me.classId, q.data.period, period, cls.semesters));
});

/** Brief 18: "chỉ hiển thị kết quả tuần đc giáo viên nhập" — the periods with results, all a family is shown. */
studentRoutes.get("/competition/entered", async (c) => {
  const me = c.get("student");
  const cls = toClassDetail((await classById(c, me.classId))!);
  return c.json(await enteredPeriods(c.env.DB, me.classId, cls.semesters));
});

/**
 * Vinh danh on the family's side (brief 12): "cho PH thấy vị trí của con mình trong tuần qua… so vs các bạn". The
 * child's own place is always theirs to see; the Top 10 only while the teacher shows it to families.
 */
studentRoutes.get("/honours/board", async (c) => {
  const me = c.get("student");
  const q = honourQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Khoảng thời gian không hợp lệ.");
  const cls = toClassDetail((await classById(c, me.classId))!);
  const period = honourPeriod(q.data.period, cls, c.get("deps").now(), q.data.date, q.data.semester);
  const [ranked, count, totals] = await Promise.all([
    periodLeaders(c.env.DB, me.classId, period, MAX_STUDENTS_PER_CLASS),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE class_id = ?").bind(me.classId).first<{ n: number }>(),
    // Every drop so far, net — the number her class list shows beside each child.
    c.env.DB.prepare("SELECT student_id, COALESCE(SUM(delta), 0) AS n FROM point_events WHERE class_id = ? GROUP BY student_id")
      .bind(me.classId)
      .all<{ student_id: number; n: number }>(),
  ]);
  const total = new Map(totals.results.map((r) => [Number(r.student_id), Number(r.n)]));
  const mine = ranked.find((l) => l.studentId === me.id);
  const board: FamilyHonourBoard = {
    period: q.data.period,
    periodKey: period.startDate,
    periodLabel: period.label,
    // Tied drops share a place, the way a class ranks.
    me: {
      rank: mine ? 1 + ranked.filter((l) => l.points > mine.points).length : null,
      points: mine?.points ?? 0,
      total: total.get(me.id) ?? 0,
      of: Number(count?.n ?? 0),
    },
    leaders: cls.showLeaderboard ? ranked.slice(0, 10).map((l) => ({ ...l, total: total.get(l.studentId) ?? 0 })) : null,
  };
  return c.json(board);
});

studentRoutes.get("/messages", async (c) => {
  const me = c.get("student");
  const now = c.get("deps").now().toISOString();
  const [, list] = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE messages SET read_at = ? WHERE student_id = ? AND sender = 'teacher' AND read_at IS NULL").bind(now, me.id),
    c.env.DB.prepare("SELECT * FROM messages WHERE student_id = ? ORDER BY created_at, id LIMIT 500").bind(me.id),
  ]);
  return c.json((list!.results as Record<string, unknown>[]).map(toMessage));
});

studentRoutes.post("/messages", async (c) => {
  const me = c.get("student");
  const body = await readJson(c, messageInput);
  if (!body.ok) return body.res;
  const row = await c.env.DB.prepare(
    "INSERT INTO messages (class_id, student_id, sender, body, created_at) VALUES (?, ?, 'family', ?, ?) RETURNING *",
  )
    .bind(me.classId, me.id, body.data.body, c.get("deps").now().toISOString())
    .first<Record<string, unknown>>();
  log("info", "family_message", { reqId: c.get("reqId"), studentId: me.id });
  return c.json(toMessage(row!), 201);
});

studentRoutes.get("/announcements", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM announcements WHERE class_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 50",
  )
    .bind(c.get("student").classId)
    .all<Record<string, unknown>>();
  return c.json(results.map(toAnnouncement));
});

studentRoutes.put("/avatar", async (c) => {
  const me = c.get("student");
  const body = await readJson(c, imageInput);
  if (!body.ok) return body.res;
  const img = decodeImage(body.data.dataUrl, "avatar");
  if (typeof img === "string") return jsonError(c, 400, "invalid_image", img);
  const now = c.get("deps").now().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO images (owner, owner_id, content_type, data, updated_at) VALUES ('student', ?, ?, ?, ?)
       ON CONFLICT (owner, owner_id) DO UPDATE SET content_type = excluded.content_type, data = excluded.data, updated_at = excluded.updated_at`,
    ).bind(me.id, img.contentType, img.base64, now),
    c.env.DB.prepare("UPDATE students SET avatar_version = avatar_version + 1, has_photo = 1, updated_at = ? WHERE id = ?").bind(now, me.id),
  ]);
  return c.json({ me: studentMe((await loadStudent(c, me.id))!) });
});

studentRoutes.delete("/avatar", async (c) => {
  const me = c.get("student");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM images WHERE owner = 'student' AND owner_id = ?").bind(me.id),
    c.env.DB.prepare("UPDATE students SET avatar_version = avatar_version + 1, has_photo = 0 WHERE id = ?").bind(me.id),
  ]);
  return c.json({ me: studentMe((await loadStudent(c, me.id))!) });
});

/**
 * "Sản phẩm của em", which the family reads under Kết quả. Only this child's own: a marked test is not something
 * a classmate gets to look at.
 */
studentRoutes.get("/works", async (c) => {
  const { results } = await c.env.DB.prepare(`${WORK_SELECT} WHERE student_id = ? ORDER BY created_at DESC, id DESC`)
    .bind(c.get("student").id)
    .all<Record<string, unknown>>();
  return c.json(results.map(toWork));
});

studentRoutes.put("/avatar-emoji", async (c) => {
  const me = c.get("student");
  const body = await readJson(c, avatarEmojiInput);
  if (!body.ok) return body.res;
  await c.env.DB.prepare("UPDATE students SET avatar_emoji = ? WHERE id = ?").bind(body.data.avatarEmoji, me.id).run();
  return c.json({ me: studentMe((await loadStudent(c, me.id))!) });
});

// The class board, the class profile book, attendance and the honour roll ------------------------

/** The tile, if it is on this child's class board. Anything else reads as "not found". */
async function myPost(c: Context<AppEnv>, pid: number | null) {
  if (pid === null) return null;
  return c.env.DB.prepare("SELECT id, class_id FROM posts WHERE id = ? AND class_id = ?")
    .bind(pid, c.get("student").classId)
    .first<{ id: number; class_id: number }>();
}

studentRoutes.get("/board", async (c) => {
  const me = c.get("student");
  const q = boardQuery.safeParse(c.req.query());
  if (!q.success) return jsonError(c, 400, "invalid_query", "Tháng không hợp lệ.");
  const month = q.data.month ?? monthKey(localDate(c.get("deps").now()));
  return c.json(await loadBoard(c.env.DB, me.classId, month, me.id));
});

/** One heart per child, however many times it is tapped. */
studentRoutes.post("/posts/:pid/like", async (c) => {
  const post = await myPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  const me = c.get("student");
  await c.env.DB.prepare("INSERT OR IGNORE INTO post_likes (post_id, student_id, created_at) VALUES (?, ?, ?)")
    .bind(post.id, me.id, c.get("deps").now().toISOString())
    .run();
  return c.json(await likeCount(c.env.DB, post.id, me.id));
});

studentRoutes.delete("/posts/:pid/like", async (c) => {
  const post = await myPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  const me = c.get("student");
  await c.env.DB.prepare("DELETE FROM post_likes WHERE post_id = ? AND student_id = ?").bind(post.id, me.id).run();
  return c.json(await likeCount(c.env.DB, post.id, me.id));
});

async function likeCount(db: D1Database, postId: number, studentId: number) {
  const r = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM post_likes WHERE post_id = ?1) AS likes,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = ?1 AND student_id = ?2) AS mine`,
    )
    .bind(postId, studentId)
    .first<{ likes: number; mine: number }>();
  return { likes: Number(r?.likes ?? 0), likedByMe: Number(r?.mine ?? 0) > 0 };
}

studentRoutes.get("/posts/:pid/comments", async (c) => {
  const post = await myPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  const me = c.get("student");
  return c.json(await loadComments(c.env.DB, post.id, { role: "student", id: me.id }));
});

studentRoutes.post("/posts/:pid/comments", async (c) => {
  const post = await myPost(c, idParam(c.req.param("pid")));
  if (!post) return notFound(c, "Không tìm thấy ô tin này.");
  const body = await readJson(c, commentInput);
  if (!body.ok) return body.res;
  const me = c.get("student");
  await c.env.DB.prepare(
    "INSERT INTO post_comments (post_id, class_id, author, student_id, body, created_at) VALUES (?, ?, 'family', ?, ?, ?)",
  )
    .bind(post.id, me.classId, me.id, body.data.body, c.get("deps").now().toISOString())
    .run();
  return c.json(await loadComments(c.env.DB, post.id, { role: "student", id: me.id }), 201);
});

/** A family can take back what they wrote; the teacher's words are hers. */
studentRoutes.delete("/posts/:pid/comments/:cid", async (c) => {
  const post = await myPost(c, idParam(c.req.param("pid")));
  const cid = idParam(c.req.param("cid"));
  if (!post || cid === null) return notFound(c, "Không tìm thấy bình luận.");
  const me = c.get("student");
  const r = await c.env.DB.prepare("DELETE FROM post_comments WHERE id = ? AND post_id = ? AND author = 'family' AND student_id = ?")
    .bind(cid, post.id, me.id)
    .run();
  if (!r.meta.changes) return notFound(c, "Không tìm thấy bình luận.");
  return c.body(null, 204);
});

/** Hồ sơ Măng non: the class, as the children wrote it. Birthdays show the day and month only. */
studentRoutes.get("/mang-non", async (c) => {
  const me = c.get("student");
  const cls = toClassDetail((await classById(c, me.classId))!);
  const { results } = await c.env.DB.prepare(`${MANG_NON_SELECT} WHERE s.class_id = ? ORDER BY s.sort_order, s.id`)
    .bind(me.classId)
    .all<Record<string, unknown>>();
  return c.json(results.map((r) => (Number(r.id) === me.id ? toMangNonRow(r, cls.teams) : hideBirthYear(toMangNonRow(r, cls.teams)))));
});

/** A child fills in their own page of the book. Their chức vụ stays the teacher's to give. */
studentRoutes.patch("/profile", async (c) => {
  const me = c.get("student");
  const body = await readJson(c, myProfileInput);
  if (!body.ok) return body.res;
  const p = body.data;
  const cols: [string, unknown][] = [];
  if (p.birthday !== undefined) cols.push(["birthday", p.birthday ?? null]);
  if (p.gender !== undefined) cols.push(["gender", p.gender ?? null]);
  if (p.hobby !== undefined) cols.push(["hobby", p.hobby]);
  if (p.dream !== undefined) cols.push(["dream", p.dream]);
  if (cols.length) {
    await c.env.DB.prepare(`UPDATE students SET ${cols.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
      .bind(...cols.map(([, v]) => v), c.get("deps").now().toISOString(), me.id)
      .run();
  }
  const cls = toClassDetail((await classById(c, me.classId))!);
  const row = await c.env.DB.prepare(`${MANG_NON_SELECT} WHERE s.id = ?`).bind(me.id).first<Record<string, unknown>>();
  return c.json(toMangNonRow(row!, cls.teams));
});

studentRoutes.get("/attendance", async (c) => {
  const me = c.get("student");
  const cls = toClassDetail((await classById(c, me.classId))!);
  const period = resolvePeriod(c.req.query(), cls, c.get("deps").now());
  if (typeof period === "string") return jsonError(c, 400, "invalid_query", period);
  return c.json(await loadStudentAttendance(c.env.DB, me.classId, me.id, period));
});

/**
 * The honour roll. A child should see their friends celebrated too — unless the teacher has hidden the Top 10, in
 * which case a family sees nothing about the other children, here either.
 */
studentRoutes.get("/honours", async (c) => {
  const me = c.get("student");
  const cls = toClassDetail((await classById(c, me.classId))!);
  const mineOnly = !cls.showLeaderboard;
  const { results } = await c.env.DB.prepare(
    `${HONOUR_SELECT} WHERE h.class_id = ?${mineOnly ? " AND h.student_id = ?" : ""} ORDER BY h.created_at DESC, h.id DESC LIMIT 100`,
  )
    .bind(...(mineOnly ? [me.classId, me.id] : [me.classId]))
    .all<Record<string, unknown>>();
  return c.json(results.map(toHonour));
});
