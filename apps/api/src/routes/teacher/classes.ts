import { Hono } from "hono";
import {
  DEFAULT_REASONS,
  DEFAULT_REWARDS,
  classInput,
  classPatch,
  currentSemester,
  defaultSemesters,
  imageInput,
  localDate,
  localMidnightUtc,
  schoolWeek,
  seatingInput,
  type ClassOverview,
  type ClassSummary,
  type LeaderRow,
  type Seating,
} from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass, semestersProblem, teacherClasses, toClassDetail, type ClassRow } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { log } from "../../lib/log";
import { decodeImage } from "../../lib/media";
import { classStudents, toPointEvent } from "../../lib/stats";
import { classBadgeDefs } from "../../lib/competition";

export const classRoutes = new Hono<AppEnv>();

function toSummary(r: ClassRow): ClassSummary {
  const d = toClassDetail(r);
  return {
    id: d.id,
    name: d.name,
    grade: d.grade,
    schoolYear: d.schoolYear,
    motto: d.motto,
    studentCount: d.studentCount,
    coverUrl: d.coverUrl,
  };
}

classRoutes.get("/classes", async (c) => {
  const rows = await teacherClasses(c);
  return c.json(rows.map(toSummary));
});

classRoutes.post("/classes", async (c) => {
  const body = await readJson(c, classInput);
  if (!body.ok) return body.res;
  const input = body.data;
  const d = defaultSemesters(Number(input.schoolYear.slice(0, 4)));
  const sem = {
    hk1Start: input.hk1Start ?? d.hk1Start,
    hk1End: input.hk1End ?? d.hk1End,
    hk2Start: input.hk2Start ?? d.hk2Start,
    hk2End: input.hk2End ?? d.hk2End,
  };
  const problem = semestersProblem(sem);
  if (problem) return jsonError(c, 400, "invalid_input", problem, { hk1End: problem });
  const row = await c.env.DB.prepare(
    `INSERT INTO classes (teacher_id, name, grade, school_year, motto, group_count, show_leaderboard,
       hk1_start, hk1_end, hk2_start, hk2_end, teams, cover_shade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      c.get("teacher").id,
      input.name,
      input.grade,
      input.schoolYear,
      input.motto,
      input.groupCount,
      input.showLeaderboard ? 1 : 0,
      sem.hk1Start,
      sem.hk1End,
      sem.hk2Start,
      sem.hk2End,
      JSON.stringify(input.teams ?? []),
      input.coverShade,
    )
    .first<{ id: number }>();
  const classId = row!.id;
  // Every class starts with the usual reasons and a small reward shop; the teacher edits them freely.
  await c.env.DB.batch([
    ...DEFAULT_REASONS.map((r, i) =>
      c.env.DB.prepare("INSERT INTO point_reasons (class_id, label, emoji, category, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?)").bind(
        classId,
        r.label,
        r.emoji,
        r.category,
        r.kind,
        i,
      ),
    ),
    ...DEFAULT_REWARDS.map((r, i) =>
      c.env.DB.prepare("INSERT INTO rewards (class_id, name, emoji, cost, sort_order) VALUES (?, ?, ?, ?, ?)").bind(
        classId,
        r.name,
        r.emoji,
        r.cost,
        i,
      ),
    ),
  ]);
  log("info", "class_created", { reqId: c.get("reqId"), classId });
  const created = await ownedClass(c, classId);
  return c.json(toClassDetail(created!), 201);
});

/** Everything the class home screen needs, in one round trip. */
classRoutes.get("/classes/:id", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const now = c.get("deps").now();
  const today = localDate(now);
  const todayStart = localMidnightUtc(today);
  const db = c.env.DB;
  const [students, badgeDefs, batch] = await Promise.all([
    classStudents(db, cls.id, now),
    classBadgeDefs(db, cls.id),
    db.batch([
      db.prepare("SELECT id, label, emoji, category, kind, drops FROM point_reasons WHERE class_id = ? AND archived = 0 ORDER BY sort_order, id").bind(cls.id),
      db
        .prepare(
          `SELECT e.*, s.full_name FROM point_events e JOIN students s ON s.id = e.student_id
           WHERE e.class_id = ? ORDER BY e.created_at DESC, e.id DESC LIMIT 12`,
        )
        .bind(cls.id),
      db
        .prepare(
          `SELECT b.student_id, s.full_name, b.badge_key, b.awarded_at FROM student_badges b JOIN students s ON s.id = b.student_id
           WHERE b.class_id = ? ORDER BY b.awarded_at DESC, b.id DESC LIMIT 8`,
        )
        .bind(cls.id),
      db
        .prepare(
          `SELECT COALESCE(SUM(delta), 0) AS total,
             COALESCE(SUM(CASE WHEN created_at >= ? THEN delta END), 0) AS today,
             COALESCE(SUM(CASE WHEN delta > 0 AND category = 'yeu_thuong' THEN 1 END), 0) AS kindness
           FROM point_events WHERE class_id = ?`,
        )
        .bind(todayStart, cls.id),
      db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM tasks WHERE class_id = ?1 AND status = 'published' AND (due_date IS NULL OR due_date >= ?2)) AS open_tasks,
             (SELECT COUNT(*) FROM redemptions WHERE class_id = ?1 AND status = 'pending') AS pending,
             (SELECT COUNT(*) FROM messages WHERE class_id = ?1 AND sender = 'family' AND read_at IS NULL) AS unread`,
        )
        .bind(cls.id, today),
    ]),
  ]);
  const [reasons, recent, badges, totals, counts] = batch;
  const t = totals!.results[0] as { total: number; today: number; kindness: number };
  const k = counts!.results[0] as { open_tasks: number; pending: number; unread: number };
  const weekTop: LeaderRow[] = students
    .filter((s) => s.weekPoints > 0)
    .sort((a, b) => b.weekPoints - a.weekPoints || a.fullName.localeCompare(b.fullName, "vi"))
    .slice(0, 10)
    .map((s) => ({
      studentId: s.id,
      fullName: s.fullName,
      avatarEmoji: s.avatarEmoji,
      avatarUrl: s.avatarUrl,
      group: s.group,
      points: s.weekPoints,
    }));
  const detail = toClassDetail(cls);
  const body: ClassOverview = {
    class: detail,
    students,
    reasons: reasons!.results as ClassOverview["reasons"],
    weekTop,
    recent: (recent!.results as Record<string, unknown>[]).map(toPointEvent),
    recentBadges: (badges!.results as Record<string, unknown>[]).map((r) => ({
      studentId: Number(r.student_id),
      fullName: String(r.full_name),
      key: String(r.badge_key),
      awardedAt: String(r.awarded_at),
    })),
    stats: {
      students: students.length,
      totalPoints: Number(t.total),
      todayPoints: Number(t.today),
      kindness: Number(t.kindness),
      openTasks: Number(k.open_tasks),
      pendingRedemptions: Number(k.pending),
      unreadMessages: Number(k.unread),
    },
    schoolWeek: schoolWeek(detail.semesters, today),
    semester: currentSemester(detail.semesters, today),
    badgeDefs,
  };
  return c.json(body);
});

classRoutes.patch("/classes/:id", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, classPatch);
  if (!body.ok) return body.res;
  const p = body.data;
  const cols: Record<string, unknown> = {
    name: p.name,
    grade: p.grade,
    school_year: p.schoolYear,
    motto: p.motto,
    group_count: p.groupCount,
    show_leaderboard: p.showLeaderboard === undefined ? undefined : p.showLeaderboard ? 1 : 0,
    hk1_start: p.hk1Start,
    hk1_end: p.hk1End,
    hk2_start: p.hk2Start,
    hk2_end: p.hk2End,
    teams: p.teams === undefined ? undefined : JSON.stringify(p.teams),
    cover_shade: p.coverShade,
  };
  const set = Object.entries(cols).filter(([, v]) => v !== undefined);
  const sem = {
    hk1Start: p.hk1Start ?? cls.hk1_start,
    hk1End: p.hk1End ?? cls.hk1_end,
    hk2Start: p.hk2Start ?? cls.hk2_start,
    hk2End: p.hk2End ?? cls.hk2_end,
  };
  const problem = semestersProblem(sem);
  if (problem) return jsonError(c, 400, "invalid_input", problem, { hk1End: problem });
  if (p.teams) {
    const ids = [...new Set(p.teams.flatMap((t) => [t.leaderId, t.deputyId]).filter((x): x is number => x !== null))];
    if (ids.length) {
      const found = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM students WHERE class_id = ? AND id IN (${ids.map(() => "?").join(",")})`)
        .bind(cls.id, ...ids)
        .first<{ n: number }>();
      if (Number(found?.n) !== ids.length) return jsonError(c, 400, "invalid_input", "Tổ trưởng, tổ phó phải là học sinh của lớp.");
    }
  }
  if (set.length) {
    await c.env.DB.prepare(`UPDATE classes SET ${set.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
      .bind(...set.map(([, v]) => v), c.get("deps").now().toISOString(), cls.id)
      .run();
  }
  if (p.groupCount !== undefined) {
    // Every child is in a tổ, so children in a tổ that no longer exists move to the last one.
    await c.env.DB.prepare("UPDATE students SET group_no = ? WHERE class_id = ? AND group_no > ?")
      .bind(p.groupCount, cls.id, p.groupCount)
      .run();
  }
  const updated = await ownedClass(c, cls.id);
  return c.json(toClassDetail(updated!));
});

classRoutes.delete("/classes/:id", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const db = c.env.DB;
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE role = 'student' AND user_id IN (SELECT id FROM students WHERE class_id = ?)").bind(cls.id),
    db.prepare("DELETE FROM images WHERE owner = 'student' AND owner_id IN (SELECT id FROM students WHERE class_id = ?)").bind(cls.id),
    db.prepare("DELETE FROM images WHERE owner = 'class' AND owner_id = ?").bind(cls.id),
    db.prepare("DELETE FROM classes WHERE id = ?").bind(cls.id),
  ]);
  log("info", "class_deleted", { reqId: c.get("reqId"), classId: cls.id });
  return c.body(null, 204);
});

classRoutes.put("/classes/:id/cover", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, imageInput);
  if (!body.ok) return body.res;
  const img = decodeImage(body.data.dataUrl, "cover");
  if (typeof img === "string") return jsonError(c, 400, "invalid_image", img);
  const now = c.get("deps").now().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO images (owner, owner_id, content_type, data, updated_at) VALUES ('class', ?, ?, ?, ?)
       ON CONFLICT (owner, owner_id) DO UPDATE SET content_type = excluded.content_type, data = excluded.data, updated_at = excluded.updated_at`,
    ).bind(cls.id, img.contentType, img.base64, now),
    c.env.DB.prepare("UPDATE classes SET cover_version = cover_version + 1, updated_at = ? WHERE id = ?").bind(now, cls.id),
  ]);
  const updated = await ownedClass(c, cls.id);
  return c.json(toClassDetail(updated!));
});

classRoutes.delete("/classes/:id/cover", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM images WHERE owner = 'class' AND owner_id = ?").bind(cls.id),
    c.env.DB.prepare("UPDATE classes SET cover_version = 0 WHERE id = ?").bind(cls.id),
  ]);
  return c.body(null, 204);
});

function parseSeating(raw: string): Seating {
  try {
    const v = JSON.parse(raw) as Partial<Seating>;
    if (v && typeof v.rows === "number") {
      return { rows: v.rows, desks: v.desks ?? 5, seatsPerDesk: v.seatsPerDesk ?? 2, seats: v.seats ?? {} };
    }
  } catch {
    // fall through to the default layout
  }
  return { rows: 4, desks: 5, seatsPerDesk: 2, seats: {} };
}

classRoutes.get("/classes/:id/seating", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  return c.json(parseSeating(cls.seating));
});

classRoutes.put("/classes/:id/seating", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, seatingInput);
  if (!body.ok) return body.res;
  const s = body.data;
  const ids = Object.values(s.seats);
  if (new Set(ids).size !== ids.length) return jsonError(c, 400, "invalid_input", "Một học sinh chỉ ngồi một chỗ.");
  for (const key of Object.keys(s.seats)) {
    const [r, d, k] = key.split("-").map(Number);
    if (r! < 1 || r! > s.rows || d! < 1 || d! > s.desks || k! < 1 || k! > s.seatsPerDesk) {
      return jsonError(c, 400, "invalid_input", "Chỗ ngồi nằm ngoài sơ đồ lớp.");
    }
  }
  if (ids.length) {
    const found = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM students WHERE class_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
    )
      .bind(cls.id, ...ids)
      .first<{ n: number }>();
    if (Number(found?.n) !== ids.length) return jsonError(c, 400, "invalid_input", "Có học sinh không thuộc lớp này.");
  }
  await c.env.DB.prepare("UPDATE classes SET seating = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(s), c.get("deps").now().toISOString(), cls.id)
    .run();
  return c.json(s);
});
