import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ClassReport, StudentHome, StudentReport } from "@lhhp/shared";
import { classroom, fixedNow, json, signIn, student } from "./helpers";

async function event(classId: number, studentId: number, delta: number, category: string, reason: string, at: string) {
  await env.DB.prepare("INSERT INTO point_events (class_id, student_id, delta, category, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(classId, studentId, delta, category, reason, at)
    .run();
}

describe("reports", () => {
  // Wednesday 23 September 2026, 10:00 in Vietnam.
  const now = fixedNow("2026-09-23T03:00:00Z");

  it("a week report buckets drops by day on Vietnam time, with totals, categories and top reasons", async () => {
    const { t, cls, accounts } = await classroom(now);
    const [an, ngoc] = accounts;
    await event(cls.id, an!.id, 3, "hoc_tap", "Phát biểu", "2026-09-20T17:30:00Z"); // Mon 00:30 local
    await event(cls.id, an!.id, 2, "yeu_thuong", "Giúp bạn", "2026-09-22T02:00:00Z"); // Tue
    await event(cls.id, ngoc!.id, -1, "ren_luyen", "Nói chuyện riêng", "2026-09-22T03:00:00Z"); // Tue
    await event(cls.id, ngoc!.id, 5, "hoc_tap", "Phát biểu", "2026-09-20T16:30:00Z"); // Sun 23:30 local: last week
    const r = await json<ClassReport>(await t.get(`/api/t/classes/${cls.id}/report?period=week`), 200);
    expect(r.period.label).toBe("Tuần 21/09 – 27/09/2026");
    expect(r.totals).toEqual({ plus: 5, minus: 1, net: 4, kindness: 1 });
    expect(r.buckets.map((b) => [b.label, b.plus, b.minus])).toEqual([
      ["T2", 3, 0],
      ["T3", 2, 1],
      ["T4", 0, 0],
      ["T5", 0, 0],
      ["T6", 0, 0],
      ["T7", 0, 0],
      ["CN", 0, 0],
    ]);
    expect(r.categories.find((c) => c.category === "yeu_thuong")).toEqual({ category: "yeu_thuong", plus: 2, minus: 0 });
    expect(r.reasons[0]).toMatchObject({ reason: "Phát biểu", count: 1, points: 3 });
    expect(r.students.map((s) => [s.fullName, s.net])).toEqual([
      ["Nguyễn Văn An", 5],
      ["Trần Bảo Ngọc", -1],
      ["Lê Minh Đức", 0],
    ]);
  });

  it("month, semester and year reports cover their ranges", async () => {
    const { t, cls, accounts } = await classroom(now);
    await event(cls.id, accounts[0]!.id, 4, "hoc_tap", "Chăm chỉ", "2026-09-10T03:00:00Z");
    await event(cls.id, accounts[0]!.id, 6, "hoc_tap", "Chăm chỉ", "2026-10-02T03:00:00Z");
    const month = await json<ClassReport>(await t.get(`/api/t/classes/${cls.id}/report?period=month&date=2026-09-01`), 200);
    expect(month.period.label).toBe("Tháng 9/2026");
    expect(month.totals.plus).toBe(4);
    const hk1 = await json<ClassReport>(await t.get(`/api/t/classes/${cls.id}/report?period=semester`), 200);
    expect(hk1.period.label).toBe("Học kỳ I (2026–2027)");
    expect(hk1.totals.plus).toBe(10);
    expect(hk1.buckets.slice(0, 2).map((b) => b.plus)).toEqual([4, 6]);
    const year = await json<ClassReport>(await t.get(`/api/t/classes/${cls.id}/report?period=year`), 200);
    expect(year.period.label).toBe("Năm học 2026–2027");
    expect(year.totals.plus).toBe(10);
    expect((await t.get(`/api/t/classes/${cls.id}/report?period=thap-ky`)).status).toBe(400);
  });

  it("counts the tasks she set, by subject", async () => {
    const { t, cls, accounts } = await classroom(now);
    await json(await t.post(`/api/t/classes/${cls.id}/tasks`, { subject: "toan", title: "Bảng nhân 7", instructions: "Học thuộc bảng nhân 7." }), 201);
    await json(await t.post(`/api/t/classes/${cls.id}/tasks`, { subject: "toan", title: "Bảng nhân 8" }), 201);
    await json(await t.post(`/api/t/classes/${cls.id}/tasks`, { subject: "tieng_viet", title: "Tả cây bàng", status: "draft" }), 201);

    const r = await json<ClassReport>(await t.get(`/api/t/classes/${cls.id}/report?period=week`), 200);
    expect(r.subjects.find((x) => x.subject === "toan")).toEqual({ subject: "toan", assigned: 2 });
    // A draft was never given out, so it is not counted.
    expect(r.subjects.find((x) => x.subject === "tieng_viet")).toEqual({ subject: "tieng_viet", assigned: 0 });

    const s = await signIn(accounts[0]!, now);
    const mine = await json<StudentReport>(await s.get("/api/s/report?period=week"), 200);
    expect(mine.subjects.find((x) => x.subject === "toan")!.assigned).toBe(2);
  });

  it("a family sees only their own child's report", async () => {
    const { t, cls, accounts } = await classroom(now);
    await event(cls.id, accounts[1]!.id, 7, "hoc_tap", "Phát biểu", "2026-09-22T03:00:00Z");
    const s = await signIn(accounts[0]!, now);
    const mine = await json<StudentReport>(await s.get("/api/s/report?period=week"), 200);
    expect(mine.totals.plus).toBe(0);
    expect(mine.events).toEqual([]);
    expect("students" in mine).toBe(false);
    void t;
  });
});

describe("student home", () => {
  it("brings level, drops, open tasks, announcements and the week's top 10 together", async () => {
    const now = fixedNow("2026-09-23T03:00:00Z");
    const { t, cls, accounts } = await classroom(now);
    for (const [i, delta] of [[0, 20], [0, 5], [1, 3]] as const) {
      await json(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[i]!.id], delta }), 201);
    }
    await t.post(`/api/t/classes/${cls.id}/tasks`, { subject: "tieng_viet", kind: "open", title: "Đọc bài Cây bàng" });
    await t.post(`/api/t/classes/${cls.id}/announcements`, { title: "Chào tuần mới" });
    const s = await signIn(accounts[0]!, now);
    const home = await json<StudentHome>(await s.get("/api/s/home"), 200);
    expect(home.profile.level).toMatchObject({ level: 2, name: "Nảy mầm" });
    expect(home.profile).toMatchObject({ available: 25, rank: 1 });
    expect(home.openTasks.map((x) => x.title)).toEqual(["Đọc bài Cây bàng"]);
    expect(home.announcements.map((a) => a.title)).toEqual(["Chào tuần mới"]);
    expect(home.weekTop!.map((x) => x.points)).toEqual([25, 3]);
    // 23/09 is in Tuần 3 (21/09 – 25/09), counted her way from Monday 7/09 (brief 18).
    expect(home.schoolWeek).toBe(3);

    await t.patch(`/api/t/classes/${cls.id}`, { showLeaderboard: false });
    expect((await json<StudentHome>(await s.get("/api/s/home"), 200)).weekTop).toBeNull();
  });
});
