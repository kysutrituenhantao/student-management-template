import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { expect } from "vitest";
import type { ClassDetail, Me, NewAccount } from "@lhhp/shared";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import type { Env } from "../src/env";

export const INVITE = "test-invite-code";

/** A browser: keeps the session cookie between calls, like the real pages do. */
export function client(deps: Partial<Deps> = {}, envOverrides: Partial<Env> = {}) {
  const app = createApp(deps);
  let cookie = "";
  async function call(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    const ctx = createExecutionContext();
    const res = await app.request(path, { ...init, headers }, { ...env, ...envOverrides } as Env, ctx);
    await waitOnExecutionContext(ctx);
    const set = res.headers.get("set-cookie");
    const m = set?.match(/lhhp_sid=([^;]*)/);
    if (m) cookie = m[1] ? `lhhp_sid=${m[1]}` : "";
    return res;
  }
  const withBody = (method: string) => (path: string, body?: unknown) =>
    call(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    call,
    get: (path: string) => call(path),
    post: withBody("POST"),
    patch: withBody("PATCH"),
    put: withBody("PUT"),
    del: (path: string) => call(path, { method: "DELETE" }),
    get cookie() {
      return cookie;
    },
    set cookie(v: string) {
      cookie = v;
    },
  };
}

export type Client = ReturnType<typeof client>;

export async function json<T>(res: Response, status?: number): Promise<T> {
  if (status !== undefined) expect(res.status, await res.clone().text()).toBe(status);
  return (await res.json()) as T;
}

export async function teacher(username = "cohoa", deps: Partial<Deps> = {}): Promise<Client> {
  const t = client(deps);
  const res = await t.post("/api/auth/teacher/register", {
    inviteCode: INVITE,
    username,
    displayName: "Cô Hoa",
    password: "matkhau-cua-co",
  });
  expect(res.status, await res.clone().text()).toBe(201);
  return t;
}

export async function makeClass(t: Client, over: Record<string, unknown> = {}): Promise<ClassDetail> {
  return json<ClassDetail>(await t.post("/api/t/classes", { name: "Lớp 4A", grade: 4, schoolYear: "2026-2027", ...over }), 201);
}

/** Every child needs a tổ, so the default spreads them over tổ 1 and 2 the way a teacher would. */
export async function addStudents(t: Client, classId: number, names: string[], groups: number[] = []) {
  return json<NewAccount[]>(
    await t.post(`/api/t/classes/${classId}/students`, {
      students: names.map((fullName, i) => ({ fullName, group: groups[i] ?? (i % 2) + 1 })),
    }),
    201,
  );
}

/**
 * Signs a child in with the password the teacher handed out. A new account is on the class's shared Abc12345, which
 * opens nothing until the family picks its own (brief 6), so this picks one the way a family would — and writes it
 * back into `account`, so the next sign-in in the same test uses it.
 */
export async function signIn(account: { username: string; password: string }, deps: Partial<Deps> = {}): Promise<Client> {
  const s = client(deps);
  const res = await json<{ me: Me }>(await s.post("/api/auth/student/login", { username: account.username, password: account.password }), 200);
  expect(res.me).toMatchObject({ role: "student" });
  if (res.me.role === "student" && res.me.mustChangePassword) {
    const chosen = `rieng-${account.username}`;
    await json(await s.post("/api/auth/password", { currentPassword: account.password, newPassword: chosen }), 200);
    account.password = chosen;
  }
  return s;
}

/** Signs a child in and has them choose their own password, the way a family that wants one does. */
export async function student(
  account: { username: string; password: string },
  newPassword = "meo-con-123",
  deps: Partial<Deps> = {},
): Promise<Client> {
  const s = await signIn(account, deps);
  await json(await s.post("/api/auth/password", { currentPassword: account.password, newPassword }), 200);
  return s;
}

/** Signs in a student who has already set their password. */
export async function login(username: string, password: string, deps: Partial<Deps> = {}): Promise<Client> {
  const s = client(deps);
  await json(await s.post("/api/auth/student/login", { username, password }), 200);
  return s;
}

/** A class with a teacher and three students, the usual starting point. */
export async function classroom(deps: Partial<Deps> = {}) {
  const t = await teacher("cohoa", deps);
  const cls = await makeClass(t);
  const accounts = await addStudents(t, cls.id, ["Nguyễn Văn An", "Trần Bảo Ngọc", "Lê Minh Đức"], [1, 2, 1]);
  return { t, cls, accounts };
}

export function fixedNow(iso: string): Partial<Deps> {
  return { now: () => new Date(iso) };
}
