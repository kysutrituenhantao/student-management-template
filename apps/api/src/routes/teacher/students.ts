import { Hono } from "hono";
import {
  AVATAR_EMOJIS,
  MAX_STUDENTS_PER_CLASS,
  imageInput,
  levelFor,
  noteInput,
  normalizeUsername,
  groupsInput,
  studentPatch,
  studentsCreateInput,
  DEFAULT_STUDENT_PASSWORD,
  pickUsername,
  usernameFor,
  type AccountSlip,
  type NewAccount,
  type StudentProfile,
} from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass } from "../../lib/classes";
import { jsonError, notFound } from "../../lib/errors";
import { log } from "../../lib/log";
import { decodeImage } from "../../lib/media";
import { availableDrops, classStudents } from "../../lib/stats";
import { ownedStudent, studentBadges, studentNotes, weekRank } from "../../lib/students";

export const studentAdminRoutes = new Hono<AppEnv>();

studentAdminRoutes.get("/classes/:id/students", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  return c.json(await classStudents(c.env.DB, cls.id, c.get("deps").now()));
});

/**
 * Usernames already in use that a new one made from these patterns could collide with. Unique across the whole app,
 * since sign-in asks for nothing else. `except` leaves out children whose own username is being replaced.
 */
async function takenLike(db: D1Database, bases: string[], except: number[] = []): Promise<Set<string>> {
  const unique = [...new Set(bases.map(normalizeUsername))];
  if (unique.length === 0) return new Set();
  const skip = except.length ? ` AND id NOT IN (${except.map(() => "?").join(",")})` : "";
  const rows = await db.batch<{ username_key: string }>(
    // A pattern is only letters and digits, so it needs no escaping in LIKE.
    unique.map((b) => db.prepare(`SELECT username_key FROM students WHERE username_key LIKE ?${skip}`).bind(`${b}%`, ...except)),
  );
  return new Set(rows.flatMap((r) => r.results.map((x) => x.username_key)));
}

/**
 * Bulk add: one account per name. Brief 6: the username is "tên lót-tên-ngày sinh" (`minhanh27`, with a letter
 * after it when it is taken) and the password is Abc12345, which the family replaces the first time it signs in.
 */
studentAdminRoutes.post("/classes/:id/students", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, studentsCreateInput);
  if (!body.ok) return body.res;
  const incoming = body.data.students;
  const existing = Number(cls.student_count ?? 0);
  if (existing + incoming.length > MAX_STUDENTS_PER_CLASS) {
    return jsonError(
      c,
      400,
      "too_many_students",
      `Một lớp có tối đa ${MAX_STUDENTS_PER_CLASS} học sinh. Lớp đang có ${existing}.`,
    );
  }
  for (const s of incoming) {
    if (s.group > cls.group_count) {
      return jsonError(c, 400, "invalid_input", `${s.fullName}: lớp chỉ có ${cls.group_count} tổ.`);
    }
  }

  const db = c.env.DB;
  const order = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM students WHERE class_id = ?").bind(cls.id).first<{ n: number }>();
  const start = Number(order?.n ?? 0);
  const now = c.get("deps").now().toISOString();

  // A clash inside one paste, or with an account already made, is settled here. One with an account made at the
  // same moment by another request is caught by the unique index below, and the teacher simply taps again.
  const bases = incoming.map((s) => usernameFor(s.fullName, s.birthday));
  const taken = await takenLike(db, bases);
  const planned = incoming.map((s, i) => {
    const username = pickUsername(bases[i]!, taken);
    taken.add(normalizeUsername(username));
    return {
      fullName: s.fullName,
      group: s.group,
      birthday: s.birthday ?? null,
      username,
      password: DEFAULT_STUDENT_PASSWORD,
      emoji: AVATAR_EMOJIS[(existing + i) % AVATAR_EMOJIS.length]!,
      sort: start + i + 1,
    };
  });

  let results: D1Result[];
  try {
    results = await db.batch(
      planned.map((p) =>
        db
          .prepare(
            `INSERT INTO students (class_id, full_name, username, username_key, password, group_no, avatar_emoji,
               sort_order, birthday, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          )
          .bind(cls.id, p.fullName, p.username, normalizeUsername(p.username), p.password, p.group, p.emoji, p.sort, p.birthday, now, now),
      ),
    );
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return jsonError(c, 409, "username_conflict", "Có tên đăng nhập vừa bị trùng. Cô bấm thêm lại một lần nữa nhé.");
    }
    throw err;
  }
  const accounts: NewAccount[] = planned.map((p, i) => ({
    id: Number((results[i]!.results[0] as { id: number }).id),
    fullName: p.fullName,
    username: p.username,
    group: p.group,
    password: p.password,
  }));
  log("info", "students_added", { reqId: c.get("reqId"), classId: cls.id, count: accounts.length });
  return c.json(accounts, 201);
});

studentAdminRoutes.get("/students/:sid", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const students = await classStudents(c.env.DB, st.class_id, c.get("deps").now());
  const row = students.find((s) => s.id === st.id)!;
  const [available, badges, notes, rank] = await Promise.all([
    availableDrops(c.env.DB, st.id),
    studentBadges(c.env.DB, st.id),
    studentNotes(c.env.DB, st.id),
    weekRank(students, st.id),
  ]);
  const body: StudentProfile = { student: row, level: levelFor(row.drops), available, badges, notes, rank };
  return c.json(body);
});

studentAdminRoutes.patch("/students/:sid", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const body = await readJson(c, studentPatch);
  if (!body.ok) return body.res;
  const p = body.data;
  if (p.group) {
    const cls = await ownedClass(c, st.class_id);
    if (p.group > cls!.group_count) return jsonError(c, 400, "invalid_input", `Lớp chỉ có ${cls!.group_count} tổ.`);
  }
  if (p.username !== undefined) {
    const key = normalizeUsername(p.username);
    const clash = await c.env.DB.prepare("SELECT id FROM students WHERE username_key = ? AND id != ?").bind(key, st.id).first();
    if (clash || key.length < 3) {
      return jsonError(c, 409, "username_taken", "Tên đăng nhập này đã có bạn khác dùng.", {
        username: "Tên đăng nhập này đã có bạn khác dùng.",
      });
    }
  }
  const cols: [string, unknown][] = [];
  if (p.fullName !== undefined) cols.push(["full_name", p.fullName]);
  if (p.group !== undefined) cols.push(["group_no", p.group]);
  if (p.username !== undefined) cols.push(["username", p.username], ["username_key", normalizeUsername(p.username)]);
  if (p.avatarEmoji !== undefined) cols.push(["avatar_emoji", p.avatarEmoji]);
  if (cols.length) {
    await c.env.DB.prepare(`UPDATE students SET ${cols.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
      .bind(...cols.map(([, v]) => v), c.get("deps").now().toISOString(), st.id)
      .run();
  }
  const students = await classStudents(c.env.DB, st.class_id, c.get("deps").now());
  return c.json(students.find((s) => s.id === st.id));
});

/**
 * "Sửa tổ": moves several children between tổ in one save, from the tổ itself rather than child by child —
 * "chưa sửa đc thành viên các tổ" (brief 3, item 5). Every child named must belong to this class.
 */
studentAdminRoutes.patch("/classes/:id/groups", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, groupsInput);
  if (!body.ok) return body.res;
  const moves = body.data.moves;
  const tooBig = moves.find((m) => m.group > Number(cls.group_count));
  if (tooBig) return jsonError(c, 400, "invalid_input", `Lớp chỉ có ${cls.group_count} tổ.`);

  const ids = [...new Set(moves.map((m) => m.studentId))];
  const found = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM students WHERE class_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
  )
    .bind(cls.id, ...ids)
    .first<{ n: number }>();
  if (Number(found?.n) !== ids.length) return jsonError(c, 400, "invalid_input", "Có học sinh không thuộc lớp này.");

  const now = c.get("deps").now().toISOString();
  await c.env.DB.batch(
    moves.map((m) =>
      c.env.DB.prepare("UPDATE students SET group_no = ?, updated_at = ? WHERE id = ? AND class_id = ?").bind(m.group, now, m.studentId, cls.id),
    ),
  );
  log("info", "groups_changed", { reqId: c.get("reqId"), classId: cls.id, moved: moves.length });
  return c.json(await classStudents(c.env.DB, cls.id, c.get("deps").now()));
});

studentAdminRoutes.delete("/students/:sid", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE role = 'student' AND user_id = ?").bind(st.id),
    c.env.DB.prepare("DELETE FROM images WHERE owner = 'student' AND owner_id = ?").bind(st.id),
    c.env.DB.prepare("DELETE FROM students WHERE id = ?").bind(st.id),
  ]);
  log("info", "student_deleted", { reqId: c.get("reqId"), studentId: st.id });
  return c.body(null, 204);
});

/**
 * "Quên mật khẩu": back to the class's first password (Abc12345, brief 6), the lock lifted, every device signed out.
 * The family chooses a new one the next time it signs in.
 */
studentAdminRoutes.post("/students/:sid/reset-password", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const password = DEFAULT_STUDENT_PASSWORD;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE students SET password = ?, password_chosen = 0, failed_logins = 0, locked_until = NULL, updated_at = ?
       WHERE id = ?`,
    ).bind(password, c.get("deps").now().toISOString(), st.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE role = 'student' AND user_id = ?").bind(st.id),
  ]);
  log("info", "student_password_reset", { reqId: c.get("reqId"), studentId: st.id });
  return c.json({ ok: true, username: st.username, password });
});

/**
 * "Tạo lại tài khoản cả lớp theo mẫu" (brief 6): a class made before the pattern existed gets it — every child's
 * username becomes "tên lót-tên-ngày sinh", every password Abc12345, and everyone is signed out. Drops, profiles and
 * everything else a child has stay exactly as they were; only how the family signs in changes.
 */
studentAdminRoutes.post("/classes/:id/accounts/pattern", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const db = c.env.DB;
  const { results: kids } = await db
    .prepare("SELECT id, full_name, birthday FROM students WHERE class_id = ? ORDER BY sort_order, id")
    .bind(cls.id)
    .all<{ id: number; full_name: string; birthday: string | null }>();
  if (kids.length === 0) return c.json([]);
  const bases = kids.map((k) => usernameFor(k.full_name, k.birthday));
  const taken = await takenLike(db, bases, kids.map((k) => k.id));
  const next = kids.map((k, i) => {
    const username = pickUsername(bases[i]!, taken);
    taken.add(normalizeUsername(username));
    return { id: k.id, username };
  });
  const now = c.get("deps").now().toISOString();
  const ids = kids.map(() => "?").join(",");
  try {
    await db.batch([
      // Out of the way first, so two children swapping usernames never meet in the unique index.
      db.prepare(`UPDATE students SET username_key = '~' || id WHERE id IN (${ids})`).bind(...kids.map((k) => k.id)),
      ...next.map((n) =>
        db
          .prepare(
            `UPDATE students SET username = ?, username_key = ?, password = ?, password_chosen = 0, failed_logins = 0,
               locked_until = NULL, updated_at = ? WHERE id = ?`,
          )
          .bind(n.username, normalizeUsername(n.username), DEFAULT_STUDENT_PASSWORD, now, n.id),
      ),
      db.prepare(`DELETE FROM sessions WHERE role = 'student' AND user_id IN (${ids})`).bind(...kids.map((k) => k.id)),
    ]);
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return jsonError(c, 409, "username_conflict", "Có tên đăng nhập vừa bị trùng. Cô bấm lại một lần nữa nhé.");
    }
    throw err;
  }
  log("info", "accounts_repatterned", { reqId: c.get("reqId"), classId: cls.id, count: kids.length });
  return c.json(next);
});

/**
 * Tài khoản cả lớp: every child's username and password, for the slips and for the parent who asks on Zalo.
 * Only this class's teacher ever sees it (`ownedClass`), and the page that shows it is marked no-store.
 */
studentAdminRoutes.get("/classes/:id/accounts", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare(
    "SELECT id, full_name, username, group_no, password, password_chosen FROM students WHERE class_id = ? ORDER BY sort_order, id",
  )
    .bind(cls.id)
    .all<{ id: number; full_name: string; username: string; group_no: number | null; password: string; password_chosen: number }>();
  const slips: AccountSlip[] = results.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    username: r.username,
    group: Number(r.group_no ?? 1),
    password: r.password,
    chosenByChild: Number(r.password_chosen) === 1,
  }));
  return c.json(slips);
});

studentAdminRoutes.put("/students/:sid/avatar", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const body = await readJson(c, imageInput);
  if (!body.ok) return body.res;
  const img = decodeImage(body.data.dataUrl, "avatar");
  if (typeof img === "string") return jsonError(c, 400, "invalid_image", img);
  const now = c.get("deps").now().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO images (owner, owner_id, content_type, data, updated_at) VALUES ('student', ?, ?, ?, ?)
       ON CONFLICT (owner, owner_id) DO UPDATE SET content_type = excluded.content_type, data = excluded.data, updated_at = excluded.updated_at`,
    ).bind(st.id, img.contentType, img.base64, now),
    c.env.DB.prepare("UPDATE students SET avatar_version = avatar_version + 1, has_photo = 1, updated_at = ? WHERE id = ?").bind(now, st.id),
  ]);
  const students = await classStudents(c.env.DB, st.class_id, c.get("deps").now());
  return c.json(students.find((s) => s.id === st.id));
});

studentAdminRoutes.delete("/students/:sid/avatar", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM images WHERE owner = 'student' AND owner_id = ?").bind(st.id),
    c.env.DB.prepare("UPDATE students SET avatar_version = avatar_version + 1, has_photo = 0 WHERE id = ?").bind(st.id),
  ]);
  return c.body(null, 204);
});

studentAdminRoutes.post("/students/:sid/notes", async (c) => {
  const st = await ownedStudent(c, idParam(c.req.param("sid")));
  if (!st) return notFound(c, "Không tìm thấy học sinh.");
  const body = await readJson(c, noteInput);
  if (!body.ok) return body.res;
  const row = await c.env.DB.prepare("INSERT INTO notes (class_id, student_id, body, created_at) VALUES (?, ?, ?, ?) RETURNING id, body, created_at")
    .bind(st.class_id, st.id, body.data.body, c.get("deps").now().toISOString())
    .first<{ id: number; body: string; created_at: string }>();
  return c.json({ id: row!.id, body: row!.body, createdAt: row!.created_at }, 201);
});

studentAdminRoutes.delete("/notes/:nid", async (c) => {
  const nid = idParam(c.req.param("nid"));
  const res = await c.env.DB.prepare(
    "DELETE FROM notes WHERE id = ? AND class_id IN (SELECT id FROM classes WHERE teacher_id = ?)",
  )
    .bind(nid, c.get("teacher").id)
    .run();
  if (res.meta.changes === 0) return notFound(c, "Không tìm thấy nhận xét.");
  return c.body(null, 204);
});
