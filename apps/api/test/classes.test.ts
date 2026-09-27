import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ClassDetail, ClassOverview, ClassSummary, NewAccount, Reward, StudentProfile, StudentRow } from "@lhhp/shared";
import { addStudents, classroom, json, makeClass, signIn, student, teacher } from "./helpers";

describe("classes", () => {
  it("creates a class with the school calendar, default reasons and a reward shop", async () => {
    const t = await teacher();
    const cls = await makeClass(t, { motto: "Học vui mỗi ngày" });
    expect(cls).toMatchObject({
      name: "Lớp 4A",
      grade: 4,
      schoolYear: "2026-2027",
      motto: "Học vui mỗi ngày",
      groupCount: 4,
      teacherName: "Cô Hoa",
      semesters: { hk1Start: "2026-09-05", hk1End: "2027-01-17", hk2Start: "2027-01-18", hk2End: "2027-05-31" },
      coverUrl: null,
    });
    expect(cls.teams.map((x) => x.name)).toEqual(["Thỏ Ngọc Chăm Chỉ", "Họa Mi Vui Vẻ", "Sóc Nâu Thông Thái", "Voi Con Dũng Mãnh"]);
    const overview = await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200);
    expect(overview.reasons.length).toBeGreaterThan(8);
    expect(overview.reasons.some((r) => r.kind === "minus")).toBe(true);
    const rewards = await json<Reward[]>(await t.get(`/api/t/classes/${cls.id}/rewards`), 200);
    expect(rewards.length).toBe(6);
  });

  it("lists only the signed-in teacher's classes, and hides others' as not found", async () => {
    const a = await teacher("coa");
    const b = await teacher("cob");
    const mine = await makeClass(a);
    await makeClass(b, { name: "Lớp 5B" });
    expect((await json<ClassSummary[]>(await a.get("/api/t/classes"), 200)).map((x) => x.name)).toEqual(["Lớp 4A"]);
    expect((await b.get(`/api/t/classes/${mine.id}`)).status).toBe(404);
    expect((await b.patch(`/api/t/classes/${mine.id}`, { name: "Hijack" })).status).toBe(404);
    expect((await b.post(`/api/t/classes/${mine.id}/students`, { students: [{ fullName: "Kẻ Lạ", group: 1 }] })).status).toBe(404);
  });

  it("updates settings, team names and semester dates, and refuses impossible dates", async () => {
    const t = await teacher();
    const cls = await makeClass(t);
    const teams = cls.teams.map((x, i) => ({ ...x, name: `Tổ số ${i + 1}` }));
    const updated = await json<ClassDetail>(await t.patch(`/api/t/classes/${cls.id}`, { motto: "Mới", teams, showLeaderboard: false }), 200);
    expect(updated).toMatchObject({ motto: "Mới", showLeaderboard: false });
    expect(updated.teams[0]!.name).toBe("Tổ số 1");
    const bad = await t.patch(`/api/t/classes/${cls.id}`, { hk1End: "2027-02-01" });
    expect(bad.status).toBe(400);
  });

  it("shrinking the number of groups moves children of a removed tổ into the last one", async () => {
    const { t, cls } = await classroom();
    await t.patch(`/api/t/classes/${cls.id}`, { groupCount: 1 });
    const students = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(students.map((s) => s.group)).toEqual([1, 1, 1]);
  });

  it("deleting a class removes its students, and signs them out", async () => {
    const { t, cls, accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    expect((await t.del(`/api/t/classes/${cls.id}`)).status).toBe(204);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM students").first())?.n).toBe(0);
    expect(await json(await s.get("/api/auth/me"), 200)).toEqual({ me: null });
  });

  it("saves the seating chart, one seat per student", async () => {
    const { t, cls, accounts } = await classroom();
    const [a, b] = accounts;
    const ok = await t.put(`/api/t/classes/${cls.id}/seating`, { rows: 4, desks: 5, seatsPerDesk: 2, seats: { "1-1-1": a!.id, "1-1-2": b!.id } });
    expect(ok.status).toBe(200);
    expect(await json(await t.get(`/api/t/classes/${cls.id}/seating`), 200)).toMatchObject({ seats: { "1-1-1": a!.id } });
    const twice = await t.put(`/api/t/classes/${cls.id}/seating`, { rows: 4, desks: 5, seatsPerDesk: 2, seats: { "1-1-1": a!.id, "2-1-1": a!.id } });
    expect(twice.status).toBe(400);
    const outside = await t.put(`/api/t/classes/${cls.id}/seating`, { rows: 2, desks: 2, seatsPerDesk: 2, seats: { "3-1-1": a!.id } });
    expect(outside.status).toBe(400);
  });
});

describe("students", () => {
  it("bulk-adds accounts named after each child, in list order, with an animal sticker each", async () => {
    const { t, cls, accounts } = await classroom();
    // "Tên lót-tên" (brief 6); these three have no birthday yet, so no day after it.
    expect(accounts.map((a) => a.username)).toEqual(["vanan", "baongoc", "minhduc"]);
    const students = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(students.map((s) => [s.fullName, s.group, s.points])).toEqual([
      ["Nguyễn Văn An", 1, 0],
      ["Trần Bảo Ngọc", 2, 0],
      ["Lê Minh Đức", 1, 0],
    ]);
    expect(new Set(students.map((s) => s.avatarEmoji)).size).toBe(3);
  });

  it("refuses a child with no tổ: every child belongs to one", async () => {
    const { t, cls } = await classroom();
    const res = await t.post(`/api/t/classes/${cls.id}/students`, { students: [{ fullName: "Phạm Gia Huy" }] });
    expect(res.status).toBe(400);
    expect(await json<{ error: { message: string } }>(res)).toMatchObject({ error: { message: "Bạn nào cũng cần có tổ." } });
  });

  it("gives classmates with the same given name different usernames, across classes too", async () => {
    const { t, cls, accounts } = await classroom();
    const more = await addStudents(t, cls.id, ["Phạm Thị An", "Hoàng An", "Vũ Thị An"]);
    const other = await teacher("cob");
    const cls2 = await makeClass(other, { name: "Lớp 4B" });
    const theirs = await addStudents(other, cls2.id, ["Nguyễn Văn An", "Trần An"]);
    const every = [accounts[0]!, ...more, ...theirs].map((a) => a.username);
    expect(new Set(every).size).toBe(every.length);
    expect(every).toEqual(["vanan", "thian", "an", "thianb", "vananb", "anb"]);
  });

  it("caps a class at 60 students", async () => {
    const t = await teacher();
    const cls = await makeClass(t);
    await addStudents(t, cls.id, Array.from({ length: 58 }, (_, i) => `Học Sinh Số${i}`));
    const res = await t.post(`/api/t/classes/${cls.id}/students`, {
      students: [
        { fullName: "A Bc", group: 1 },
        { fullName: "D Ef", group: 1 },
        { fullName: "G Hi", group: 1 },
      ],
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "too_many_students" } });
  });

  it("refuses a group the class doesn't have", async () => {
    const t = await teacher();
    const cls = await makeClass(t, { groupCount: 2 });
    const res = await t.post(`/api/t/classes/${cls.id}/students`, { students: [{ fullName: "Nguyễn Văn An", group: 3 }] });
    expect(res.status).toBe(400);
  });

  it("edits a student's name, group, sticker and username; a taken username is refused", async () => {
    const { t, accounts } = await classroom();
    const [an, ngoc] = accounts as [NewAccount, NewAccount];
    const row = await json<StudentRow>(
      await t.patch(`/api/t/students/${an.id}`, { fullName: "Nguyễn Văn Bình An", group: 3, avatarEmoji: "🦊", username: "binhan.k7m4" }),
      200,
    );
    expect(row).toMatchObject({ fullName: "Nguyễn Văn Bình An", group: 3, avatarEmoji: "🦊", username: "binhan.k7m4" });
    const clash = await t.patch(`/api/t/students/${ngoc.id}`, { username: "BinhAn.K7M4" });
    expect(clash.status).toBe(409);
    // Case, spaces and the dot don't matter at sign-in.
    expect((await signIn({ username: "BINH AN K7M4", password: accounts[0]!.password })).cookie).toMatch(/lhhp_sid/);
  });

  it("shows a profile with level, drops to spend, badges and notes", async () => {
    const { t, cls, accounts } = await classroom();
    const id = accounts[0]!.id;
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [id], delta: 5 });
    await t.post(`/api/t/students/${id}/notes`, { body: "Con tiến bộ nhiều trong môn Toán." });
    const p = await json<StudentProfile>(await t.get(`/api/t/students/${id}`), 200);
    expect(p.student.points).toBe(5);
    expect(p.level).toMatchObject({ level: 1, toNext: 5 });
    expect(p.available).toBe(5);
    expect(p.badges.map((b) => b.key)).toEqual(["first_star"]);
    expect(p.notes.map((n) => n.body)).toEqual(["Con tiến bộ nhiều trong môn Toán."]);
    expect(p.rank).toBe(1);
  });

  /** "Chưa sửa đc thành viên các tổ" (brief 3, item 5): the tổ is edited from the tổ, several children at a time. */
  it("moves several children between tổ in one save", async () => {
    const { t, cls, accounts } = await classroom();
    const [an, ngoc, duc] = accounts; // tổ 1, 2, 1
    const after = await json<StudentRow[]>(
      await t.patch(`/api/t/classes/${cls.id}/groups`, {
        moves: [
          { studentId: duc!.id, group: 2 },
          { studentId: ngoc!.id, group: 3 },
        ],
      }),
      200,
    );
    expect(after.map((s) => [s.fullName, s.group])).toEqual([
      ["Nguyễn Văn An", 1],
      ["Trần Bảo Ngọc", 3],
      ["Lê Minh Đức", 2],
    ]);
    void an;
  });

  it("refuses a tổ the class does not have, and a child from another class", async () => {
    const { t, cls, accounts } = await classroom();
    const other = await teacher("cothu");
    const theirs = await makeClass(other, { name: "Lớp 4B" });
    const [stranger] = await addStudents(other, theirs.id, ["Người Lạ"]);

    expect((await t.patch(`/api/t/classes/${cls.id}/groups`, { moves: [{ studentId: accounts[0]!.id, group: 5 }] })).status).toBe(400);
    expect((await t.patch(`/api/t/classes/${cls.id}/groups`, { moves: [{ studentId: stranger!.id, group: 1 }] })).status).toBe(400);
    // And another teacher cannot reshuffle this class at all.
    expect((await other.patch(`/api/t/classes/${cls.id}/groups`, { moves: [{ studentId: accounts[0]!.id, group: 2 }] })).status).toBe(404);
    // Nothing moved.
    const rows = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(rows.map((s) => s.group)).toEqual([1, 2, 1]);
  });

  it("deletes a student with everything they had", async () => {
    const { t, cls, accounts } = await classroom();
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 3 });
    expect((await t.del(`/api/t/students/${accounts[0]!.id}`)).status).toBe(204);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM point_events").first())?.n).toBe(0);
    expect((await t.get(`/api/t/students/${accounts[0]!.id}`)).status).toBe(404);
  });
});
