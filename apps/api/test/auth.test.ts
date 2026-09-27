import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Me } from "@lhhp/shared";
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS } from "../src/lib/password";
import { INVITE, addStudents, classroom, client, json, makeClass, signIn, student, teacher } from "./helpers";

describe("teacher accounts", () => {
  it("needs the invite code to register", async () => {
    const res = await client().post("/api/auth/teacher/register", {
      inviteCode: "wrong",
      username: "cohoa",
      displayName: "Cô Hoa",
      password: "matkhau-cua-co",
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "bad_invite_code", fields: { inviteCode: "Mã mời chưa đúng." } } });
  });

  it("refuses to register anyone when no invite code is configured", async () => {
    const res = await client({}, { TEACHER_INVITE_CODE: "" }).post("/api/auth/teacher/register", {
      inviteCode: "",
      username: "cohoa",
      displayName: "Cô Hoa",
      password: "matkhau-cua-co",
    });
    expect(res.status).toBe(400);
  });

  it("registers, is signed in at once, and can sign out and back in", async () => {
    const t = await teacher();
    expect(t.cookie).toMatch(/^lhhp_sid=/);
    expect(await json(await t.get("/api/auth/me"), 200)).toEqual({ me: { role: "teacher", id: expect.any(Number), username: "cohoa", displayName: "Cô Hoa" } });

    await t.post("/api/auth/logout");
    expect(t.cookie).toBe("");
    expect(await json(await t.get("/api/auth/me"), 200)).toEqual({ me: null });

    const again = await t.post("/api/auth/teacher/login", { username: "COHOA", password: "matkhau-cua-co" });
    expect(again.status).toBe(200);
    expect(await json(await t.get("/api/auth/me"), 200)).toMatchObject({ me: { role: "teacher" } });
  });

  it("won't reuse a taken username", async () => {
    await teacher("cohoa");
    const res = await client().post("/api/auth/teacher/register", {
      inviteCode: INVITE,
      username: "CoHoa",
      displayName: "Cô Hoa 2",
      password: "matkhau-cua-co",
    });
    expect(res.status).toBe(409);
  });

  it("sets an HttpOnly, SameSite=Lax session cookie", async () => {
    const res = await client().post("/api/auth/teacher/register", {
      inviteCode: INVITE,
      username: "cohoa",
      displayName: "Cô Hoa",
      password: "matkhau-cua-co",
    });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Secure/); // SITE_URL is http in tests; production is https and adds Secure
  });

  it("keeps teacher routes closed to students and strangers", async () => {
    const { accounts } = await classroom();
    expect((await client().get("/api/t/classes")).status).toBe(401);
    const s = await signIn(accounts[0]!);
    expect((await s.get("/api/t/classes")).status).toBe(401);
  });
});

describe("student sign-in", () => {
  it("accepts the username however it's typed: with a dot or a space in it, with marks, in capitals", async () => {
    const { accounts } = await classroom();
    const an = accounts[0]!;
    expect(an.username).toBe("vanan");
    for (const typed of [an.username, "van.an", " VANAN ", "van an", "Văn An"]) {
      const res = await client().post("/api/auth/student/login", { username: typed, password: an.password });
      expect(res.status, typed).toBe(200);
    }
  });

  it("on Abc12345, asks the family for its own password before opening the child's pages", async () => {
    const { accounts } = await classroom();
    const s = client();
    const { me } = await json<{ me: Me }>(await s.post("/api/auth/student/login", accounts[0]!), 200);
    expect(me).toMatchObject({ role: "student", fullName: "Nguyễn Văn An", className: "Lớp 4A", mustChangePassword: true });
    expect((await s.get("/api/s/home")).status).toBe(403);
    await json(await s.post("/api/auth/password", { currentPassword: accounts[0]!.password, newPassword: "meo-con-123" }), 200);
    expect((await s.get("/api/s/home")).status).toBe(200);
  });

  it("lets a family choose their own password, and signs the other devices out", async () => {
    const { accounts } = await classroom();
    const an = accounts[0]!;
    const other = client();
    await other.post("/api/auth/student/login", an);
    const s = await student(an, "meo-con-123");
    expect(await json(await other.get("/api/auth/me"), 200)).toEqual({ me: null });
    expect((await client().post("/api/auth/student/login", { username: an.username, password: an.password })).status).toBe(401);
    expect((await client().post("/api/auth/student/login", { username: an.username, password: "meo-con-123" })).status).toBe(200);
    void s;
  });

  it("gives one message for a wrong username or a wrong password", async () => {
    const { accounts } = await classroom();
    const a = await client().post("/api/auth/student/login", { username: "nobody.k7m4", password: "abcd12" });
    const b = await client().post("/api/auth/student/login", { username: accounts[0]!.username, password: "wrong1" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
  });

  it("locks the account after 8 wrong passwords, and the teacher's reset unlocks it", async () => {
    const { t, accounts } = await classroom();
    const an = accounts[0]!;
    const c = client();
    for (let i = 0; i < 8; i++) await c.post("/api/auth/student/login", { username: an.username, password: "wrong1" });
    const locked = await c.post("/api/auth/student/login", { username: an.username, password: an.password });
    expect(locked.status).toBe(429);
    expect(await locked.json()).toMatchObject({ error: { code: "locked" } });

    const reset = await json<{ password: string }>(await t.post(`/api/t/students/${an.id}/reset-password`), 200);
    expect((await c.post("/api/auth/student/login", { username: an.username, password: reset.password })).status).toBe(200);
  });

  it("a teacher's reset ends the child's sessions and only the new code works", async () => {
    const { t, accounts } = await classroom();
    const ngoc = accounts[1]!;
    const s = await student(ngoc, "sao-sang-1");
    const reset = await json<{ password: string }>(await t.post(`/api/t/students/${ngoc.id}/reset-password`), 200);
    expect(await json(await s.get("/api/auth/me"), 200)).toEqual({ me: null });
    expect((await client().post("/api/auth/student/login", { username: ngoc.username, password: "sao-sang-1" })).status).toBe(401);
    const { me } = await json<{ me: Me }>(
      await client().post("/api/auth/student/login", { username: ngoc.username, password: reset.password }),
      200,
    );
    expect(me).toMatchObject({ role: "student", fullName: "Trần Bảo Ngọc" });
  });
});
