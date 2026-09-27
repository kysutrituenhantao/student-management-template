import { describe, expect, it } from "vitest";
import type { ClassDetail, Me, StudentRow } from "@lhhp/shared";
import { addStudents, classroom, client, json, makeClass, signIn, student, teacher } from "./helpers";

// A 1×1 PNG and a tiny WebP header.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const WEBP =
  "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

describe("photos", () => {
  it("a student uploads an avatar; classmates and the teacher see it, nobody else does", async () => {
    const { t, cls, accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    const { me } = await json<{ me: Me & { avatarUrl: string } }>(await s.put("/api/s/avatar", { dataUrl: PNG }), 200);
    expect(me.avatarUrl).toMatch(/^\/api\/media\/student\/\d+\?v=1$/);

    const own = await s.get(me.avatarUrl);
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("image/png");
    expect(own.headers.get("cache-control")).toContain("private");

    const classmate = await signIn(accounts[1]!);
    expect((await classmate.get(me.avatarUrl)).status).toBe(200);
    expect((await t.get(me.avatarUrl)).status).toBe(200);

    expect((await client().get(me.avatarUrl)).status).toBe(404);
    const other = await teacher("cob");
    const otherClass = await makeClass(other, { name: "Lớp 5A" });
    const [stranger] = await addStudents(other, otherClass.id, ["Người Lạ"]);
    const strangerClient = await signIn(stranger!);
    expect((await strangerClient.get(me.avatarUrl)).status).toBe(404);
    expect((await other.get(me.avatarUrl)).status).toBe(404);
    void cls;
  });

  it("rejects an image whose bytes don't match its type", async () => {
    const { accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    const res = await s.put("/api/s/avatar", { dataUrl: "data:image/png;base64,PGh0bWw+PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized avatar", async () => {
    const { accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    const big = "data:image/png;base64,iVBORw0KGgo" + "A".repeat(200_000);
    expect((await s.put("/api/s/avatar", { dataUrl: big })).status).toBe(400);
  });

  it("the teacher sets a class cover and a student's photo; removing them clears the URLs", async () => {
    const { t, cls, accounts } = await classroom();
    const withCover = await json<ClassDetail>(await t.put(`/api/t/classes/${cls.id}/cover`, { dataUrl: PNG }), 200);
    expect(withCover.coverUrl).toMatch(/^\/api\/media\/class\/\d+\?v=1$/);
    const s = await signIn(accounts[0]!);
    expect((await s.get(withCover.coverUrl!)).status).toBe(200);
    expect((await t.del(`/api/t/classes/${cls.id}/cover`)).status).toBe(204);
    expect((await s.get(withCover.coverUrl!)).status).toBe(404);

    const row = await json<StudentRow>(await t.put(`/api/t/students/${accounts[1]!.id}/avatar`, { dataUrl: PNG }), 200);
    expect(row.avatarUrl).toMatch(/\?v=\d+$/);
    await t.del(`/api/t/students/${accounts[1]!.id}/avatar`);
    const students = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(students[1]!.avatarUrl).toBeNull();
  });

  /**
   * "Ảnh đại diện của HS k thể thay đổi." A photo is cached `immutable` for a year, so a second photo must never
   * land on the URL the first one had — including after the first was removed.
   */
  it("a replaced photo never reuses the URL of the one before it", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    const first = await json<StudentRow>(await t.put(`/api/t/students/${sid}/avatar`, { dataUrl: PNG }), 200);

    // Straight replacement.
    const second = await json<StudentRow>(await t.put(`/api/t/students/${sid}/avatar`, { dataUrl: WEBP }), 200);
    expect(second.avatarUrl).not.toBe(first.avatarUrl);

    // And the way she actually did it: take the photo off, put another one on.
    expect((await t.del(`/api/t/students/${sid}/avatar`)).status).toBe(204);
    const third = await json<StudentRow>(await t.put(`/api/t/students/${sid}/avatar`, { dataUrl: PNG }), 200);
    expect(third.avatarUrl).not.toBe(first.avatarUrl);
    expect(third.avatarUrl).not.toBe(second.avatarUrl);
    expect((await t.get(third.avatarUrl!)).status).toBe(200);
  });

  it("a child replacing their own photo gets a new URL too", async () => {
    const { accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    const { me: a } = await json<{ me: Me & { avatarUrl: string } }>(await s.put("/api/s/avatar", { dataUrl: PNG }), 200);
    await json(await s.del("/api/s/avatar"), 200);
    const { me: b } = await json<{ me: Me & { avatarUrl: string } }>(await s.put("/api/s/avatar", { dataUrl: WEBP }), 200);
    expect(b.avatarUrl).not.toBe(a.avatarUrl);
  });

  it("a child can pick a sticker instead of a photo", async () => {
    const { accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    const { me } = await json<{ me: Me & { avatarEmoji: string } }>(await s.put("/api/s/avatar-emoji", { avatarEmoji: "🦄" }), 200);
    expect(me.avatarEmoji).toBe("🦄");
    expect((await s.put("/api/s/avatar-emoji", { avatarEmoji: "💩" })).status).toBe(400);
  });
});
