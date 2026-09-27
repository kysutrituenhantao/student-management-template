import { Hono, type Context } from "hono";
import { createMiddleware } from "hono/factory";
import {
  DEFAULT_STUDENT_PASSWORD,
  changePasswordInput,
  loginInput,
  normalizeUsername,
  teacherRegisterInput,
  type Me,
} from "@lhhp/shared";
import type { AppEnv } from "../types";
import { clientIp, rateKey, readJson } from "../lib/body";
import { jsonError } from "../lib/errors";
import { log } from "../lib/log";
import { avatarUrl } from "../lib/media";
import { hashPassword, verifyPassword, verifyStudentPassword } from "../lib/password";
import {
  currentUser,
  endOtherSessions,
  endSession,
  loadStudent,
  sha256Hex,
  startSession,
  type StudentAccount,
  type TeacherAccount,
} from "../lib/session";

export const authRoutes = new Hono<AppEnv>();

const MAX_FAILURES = 8;
const LOCK_MINUTES = 10;
const WRONG = "Tên đăng nhập hoặc mật khẩu chưa đúng.";

/** Caps sign-in attempts per IP, checked before any password work. */
const rateLimited = createMiddleware<AppEnv>(async (c, next) => {
  const ip = clientIp(c);
  if (ip && c.env.LOGIN_LIMITER && !(await c.env.LOGIN_LIMITER.limit({ key: rateKey(ip) })).success) {
    log("warn", "rate_limited", { reqId: c.get("reqId"), path: c.req.path });
    c.header("retry-after", "60");
    return jsonError(c, 429, "rate_limited", "Thử nhiều lần quá. Đợi một phút rồi thử lại nhé.");
  }
  await next();
});

export function teacherMe(t: TeacherAccount): Me {
  return { role: "teacher", id: t.id, username: t.username, displayName: t.displayName };
}

export function studentMe(s: StudentAccount): Me {
  return {
    role: "student",
    id: s.id,
    username: s.username,
    fullName: s.fullName,
    classId: s.classId,
    className: s.className,
    teacherName: s.teacherName,
    avatarEmoji: s.avatarEmoji,
    avatarUrl: avatarUrl(s.id, s.avatarVersion, s.hasPhoto),
    mustChangePassword: s.mustChangePassword,
  };
}

interface Credentials {
  id: number;
  /** The teacher's PBKDF2 hash, or the child's password as the teacher reads it out. */
  secret: string;
}

/**
 * Shared by both sign-in forms and the change-password form. Eight wrong passwords in a row lock the account for ten
 * minutes; the teacher's password reset lifts a student's lock at once.
 *
 * The attempt is counted before the password is checked, in one UPDATE, so guesses sent all at once each take their own
 * number and the ninth is refused unchecked.
 */
async function checkPassword(
  c: Context<AppEnv>,
  table: "teachers" | "students",
  row: Credentials | null,
  password: string,
  opts: { signIn: boolean } = { signIn: true },
): Promise<Response | null> {
  const matches = (given: string, stored: string) =>
    table === "students" ? verifyStudentPassword(given, stored) : verifyPassword(given, stored);
  const now = c.get("deps").now();
  const nowIso = now.toISOString();
  if (!row) return jsonError(c, 401, "wrong_credentials", WRONG);
  const locked = () => {
    log("warn", "login_locked", { reqId: c.get("reqId"), table, id: row.id });
    return jsonError(
      c,
      429,
      "locked",
      table === "students"
        ? `Nhập sai nhiều lần quá. Con thử lại sau ${LOCK_MINUTES} phút, hoặc nhờ cô đặt lại mật khẩu nhé.`
        : `Nhập sai nhiều lần quá. Thử lại sau ${LOCK_MINUTES} phút.`,
    );
  };
  const lock = () =>
    c.env.DB.prepare(`UPDATE ${table} SET failed_logins = 0, locked_until = ? WHERE id = ?`)
      .bind(new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString(), row.id)
      .run();

  const counted = await c.env.DB.prepare(
    `UPDATE ${table} SET failed_logins = CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed_logins + 1 END, locked_until = NULL
     WHERE id = ? AND (locked_until IS NULL OR locked_until <= ?) RETURNING failed_logins`,
  )
    .bind(row.id, nowIso)
    .first<{ failed_logins: number }>();
  if (!counted) return locked();
  if (counted.failed_logins > MAX_FAILURES) {
    await lock();
    return locked();
  }

  if (!(await matches(password, row.secret))) {
    if (counted.failed_logins >= MAX_FAILURES) await lock();
    log("warn", "login_failed", { reqId: c.get("reqId"), table, id: row.id, locked: counted.failed_logins >= MAX_FAILURES });
    return opts.signIn
      ? jsonError(c, 401, "wrong_credentials", WRONG)
      : jsonError(c, 400, "wrong_password", "Mật khẩu hiện tại chưa đúng.", { currentPassword: "Mật khẩu hiện tại chưa đúng." });
  }
  await c.env.DB.prepare(
    `UPDATE ${table} SET failed_logins = 0, locked_until = NULL${opts.signIn ? ", last_login_at = ?" : ""} WHERE id = ?`,
  )
    .bind(...(opts.signIn ? [nowIso, row.id] : [row.id]))
    .run();
  return null;
}

authRoutes.post("/teacher/register", rateLimited, async (c) => {
  const body = await readJson(c, teacherRegisterInput);
  if (!body.ok) return body.res;
  const input = body.data;
  const expected = c.env.TEACHER_INVITE_CODE ?? "";
  if (!expected || (await sha256Hex(input.inviteCode)) !== (await sha256Hex(expected))) {
    log("warn", "invite_code_rejected", { reqId: c.get("reqId") });
    return jsonError(c, 403, "bad_invite_code", "Mã mời chưa đúng.", { inviteCode: "Mã mời chưa đúng." });
  }
  const taken = await c.env.DB.prepare("SELECT 1 FROM teachers WHERE username = ?").bind(input.username).first();
  if (taken) {
    return jsonError(c, 409, "username_taken", "Tên đăng nhập này đã có người dùng.", {
      username: "Tên đăng nhập này đã có người dùng.",
    });
  }
  const row = await c.env.DB.prepare(
    "INSERT INTO teachers (username, display_name, password_hash) VALUES (?, ?, ?) RETURNING id, username, display_name",
  )
    .bind(input.username, input.displayName, await hashPassword(input.password))
    .first<{ id: number; username: string; display_name: string }>();
  await startSession(c, "teacher", row!.id);
  log("info", "teacher_registered", { reqId: c.get("reqId"), id: row!.id });
  return c.json({ me: teacherMe({ id: row!.id, username: row!.username, displayName: row!.display_name }) }, 201);
});

authRoutes.post("/teacher/login", rateLimited, async (c) => {
  const body = await readJson(c, loginInput);
  if (!body.ok) return body.res;
  const row = await c.env.DB.prepare(
    "SELECT id, username, display_name, password_hash AS secret FROM teachers WHERE username = ?",
  )
    .bind(body.data.username.trim())
    .first<Credentials & { username: string; display_name: string }>();
  const denied = await checkPassword(c, "teachers", row, body.data.password);
  if (denied) return denied;
  await startSession(c, "teacher", row!.id);
  return c.json({ me: teacherMe({ id: row!.id, username: row!.username, displayName: row!.display_name }) });
});

authRoutes.post("/student/login", rateLimited, async (c) => {
  const body = await readJson(c, loginInput);
  if (!body.ok) return body.res;
  const row = await c.env.DB.prepare("SELECT id, password AS secret FROM students WHERE username_key = ?")
    .bind(normalizeUsername(body.data.username))
    .first<Credentials>();
  const denied = await checkPassword(c, "students", row, body.data.password);
  if (denied) return denied;
  await startSession(c, "student", row!.id);
  const student = await loadStudent(c, row!.id);
  return c.json({ me: studentMe(student!) });
});

authRoutes.post("/logout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});

/** Who is signed in. `{ me: null }` when nobody is, so the pages can ask without an error in the console. */
authRoutes.get("/me", async (c) => {
  const who = await currentUser(c);
  c.header("cache-control", "no-store");
  if (!who) return c.json({ me: null });
  return c.json({ me: who.role === "teacher" ? teacherMe(who.teacher) : studentMe(who.student) });
});

authRoutes.post("/password", rateLimited, async (c) => {
  const who = await currentUser(c);
  if (!who) return jsonError(c, 401, "unauthorized", "Hãy đăng nhập để tiếp tục.");
  const body = await readJson(c, changePasswordInput);
  if (!body.ok) return body.res;
  const { currentPassword, newPassword } = body.data;
  if (who.role === "teacher" && newPassword.length < 8) {
    return jsonError(c, 400, "invalid_input", "Mật khẩu mới cần ít nhất 8 ký tự.", {
      newPassword: "Mật khẩu mới cần ít nhất 8 ký tự.",
    });
  }
  // The class's shared first password is the one thing a chosen password may not be.
  if (who.role === "student" && newPassword.toLowerCase() === DEFAULT_STUDENT_PASSWORD.toLowerCase()) {
    const msg = `Nhà mình chọn một mật khẩu khác ${DEFAULT_STUDENT_PASSWORD} nhé — cả lớp đều biết mật khẩu này.`;
    return jsonError(c, 400, "invalid_input", msg, { newPassword: msg });
  }
  const table = who.role === "teacher" ? "teachers" : "students";
  const id = who.role === "teacher" ? who.teacher.id : who.student.id;
  const row = await c.env.DB.prepare(
    `SELECT id, ${table === "students" ? "password" : "password_hash"} AS secret FROM ${table} WHERE id = ?`,
  )
    .bind(id)
    .first<Credentials>();
  const denied = await checkPassword(c, table, row, currentPassword, { signIn: false });
  if (denied) return denied;
  const now = c.get("deps").now().toISOString();
  // A child's new password is kept as they typed it, so the teacher can still read it out to a parent who asks.
  await c.env.DB.prepare(
    table === "students"
      ? "UPDATE students SET password = ?, password_chosen = 1, updated_at = ? WHERE id = ?"
      : "UPDATE teachers SET password_hash = ?, updated_at = ? WHERE id = ?",
  )
    .bind(table === "students" ? newPassword : await hashPassword(newPassword), now, id)
    .run();
  // Anyone else signed in with the old password is signed out.
  await endOtherSessions(c, who.role, id, who.hash);
  log("info", "password_changed", { reqId: c.get("reqId"), role: who.role, id });
  if (who.role === "teacher") return c.json({ me: teacherMe(who.teacher) });
  const student = await loadStudent(c, id);
  return c.json({ me: studentMe(student!) });
});
