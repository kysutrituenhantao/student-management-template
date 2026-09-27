import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { DEFAULT_STUDENT_PASSWORD } from "@lhhp/shared";
import type { AppEnv } from "../types";
import { jsonError } from "./errors";

export const SESSION_COOKIE = "lhhp_sid";
const DAY_MS = 86_400_000;
/** Families sign in on a shared phone or computer and stay signed in for a month. */
const SESSION_DAYS = 30;
const RENEW_BELOW_DAYS = 15;

export type Role = "teacher" | "student";

export interface TeacherAccount {
  id: number;
  username: string;
  displayName: string;
}

export interface StudentAccount {
  id: number;
  username: string;
  fullName: string;
  classId: number;
  className: string;
  teacherName: string;
  avatarEmoji: string;
  /** Counts the photos this child has had; `hasPhoto` says whether one is set now. See lib/media.ts. */
  avatarVersion: number;
  hasPhoto: boolean;
  /** See `StudentMe.mustChangePassword`. */
  mustChangePassword: boolean;
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function cookieOptions(c: Context<AppEnv>, expires: Date) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    // Browsers drop Secure cookies on plain http, which the local stack and e2e use.
    secure: c.env.SITE_URL.startsWith("https://"),
    expires,
  };
}

export async function startSession(c: Context<AppEnv>, role: Role, userId: number): Promise<void> {
  const now = c.get("deps").now();
  const token = newToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now.toISOString()),
    c.env.DB.prepare("INSERT INTO sessions (token_hash, role, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(
      await sha256Hex(token),
      role,
      userId,
      expires.toISOString(),
      now.toISOString(),
    ),
  ]);
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c, expires));
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** Signs the user out everywhere except, optionally, the session making this request. */
export async function endOtherSessions(c: Context<AppEnv>, role: Role, userId: number, keepHash?: string) {
  await c.env.DB.prepare("DELETE FROM sessions WHERE role = ? AND user_id = ? AND token_hash != ?")
    .bind(role, userId, keepHash ?? "")
    .run();
}

interface SessionRow {
  token_hash: string;
  role: Role;
  user_id: number;
  expires_at: string;
}

async function readSession(c: Context<AppEnv>): Promise<SessionRow | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const hash = await sha256Hex(token);
  const now = c.get("deps").now();
  const row = await c.env.DB.prepare("SELECT token_hash, role, user_id, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(hash, now.toISOString())
    .first<SessionRow>();
  if (!row) return null;
  // Sliding expiry, written at most once every couple of weeks per session.
  if (new Date(row.expires_at).getTime() - now.getTime() < RENEW_BELOW_DAYS * DAY_MS) {
    const expires = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
    await c.env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").bind(expires.toISOString(), hash).run();
    setCookie(c, SESSION_COOKIE, token, cookieOptions(c, expires));
  }
  return row;
}

async function loadTeacher(c: Context<AppEnv>, id: number): Promise<TeacherAccount | null> {
  const r = await c.env.DB.prepare("SELECT id, username, display_name FROM teachers WHERE id = ?")
    .bind(id)
    .first<{ id: number; username: string; display_name: string }>();
  return r ? { id: r.id, username: r.username, displayName: r.display_name } : null;
}

export async function loadStudent(c: Context<AppEnv>, id: number): Promise<StudentAccount | null> {
  const r = await c.env.DB.prepare(
    `SELECT s.id, s.username, s.full_name, s.class_id, s.avatar_emoji, s.avatar_version, s.has_photo,
            (s.password = ? AND s.password_chosen = 0) AS must_change,
            c.name AS class_name, t.display_name AS teacher_name
     FROM students s JOIN classes c ON c.id = s.class_id JOIN teachers t ON t.id = c.teacher_id
     WHERE s.id = ?`,
  )
    .bind(DEFAULT_STUDENT_PASSWORD, id)
    .first<Record<string, string | number>>();
  if (!r) return null;
  return {
    id: Number(r.id),
    username: String(r.username),
    fullName: String(r.full_name),
    classId: Number(r.class_id),
    className: String(r.class_name),
    teacherName: String(r.teacher_name),
    avatarEmoji: String(r.avatar_emoji),
    avatarVersion: Number(r.avatar_version),
    hasPhoto: Number(r.has_photo ?? 0) === 1,
    mustChangePassword: Number(r.must_change) === 1,
  };
}

/** Resolves whoever is signed in, for routes open to both roles. */
export async function currentUser(
  c: Context<AppEnv>,
): Promise<{ role: "teacher"; teacher: TeacherAccount; hash: string } | { role: "student"; student: StudentAccount; hash: string } | null> {
  const s = await readSession(c);
  if (!s) return null;
  if (s.role === "teacher") {
    const teacher = await loadTeacher(c, s.user_id);
    return teacher ? { role: "teacher", teacher, hash: s.token_hash } : null;
  }
  const student = await loadStudent(c, s.user_id);
  return student ? { role: "student", student, hash: s.token_hash } : null;
}

export const requireTeacher: MiddlewareHandler<AppEnv> = async (c, next) => {
  const who = await currentUser(c);
  if (!who || who.role !== "teacher") return jsonError(c, 401, "unauthorized", "Cô hãy đăng nhập để tiếp tục.");
  c.set("teacher", who.teacher);
  c.set("sessionHash", who.hash);
  await next();
  c.res.headers.set("cache-control", "no-store");
};

export const requireStudent: MiddlewareHandler<AppEnv> = async (c, next) => {
  const who = await currentUser(c);
  if (!who || who.role !== "student") return jsonError(c, 401, "unauthorized", "Con hãy đăng nhập để tiếp tục.");
  // The whole class shares Abc12345 until each family picks its own, so that password opens nothing but the change.
  if (who.student.mustChangePassword) {
    return jsonError(c, 403, "must_change_password", "Nhà mình đặt mật khẩu riêng trước đã nhé.");
  }
  c.set("student", who.student);
  c.set("sessionHash", who.hash);
  await next();
  c.res.headers.set("cache-control", "no-store");
};
