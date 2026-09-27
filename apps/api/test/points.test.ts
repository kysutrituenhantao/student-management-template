import { describe, expect, it } from "vitest";
import type { ClassOverview, PointEvent, PointsResult, Reason, StudentRow } from "@lhhp/shared";
import { classroom, json, teacher, makeClass } from "./helpers";

describe("points", () => {
  it("a tap on a sticker scores at once, without a reason", async () => {
    const { t, cls, accounts } = await classroom();
    const r = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 1 }), 201);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ delta: 1, reason: "Khen nhanh", category: "chung", studentName: "Nguyễn Văn An" });
    const minus = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: -1 }), 201);
    expect(minus.events[0]).toMatchObject({ delta: -1, reason: "Nhắc nhở" });
    const students = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(students[0]).toMatchObject({ points: 0, drops: 1, weekPoints: 0 });
  });

  it("scores several students with one reason, and one undo takes it all back", async () => {
    const { t, cls, accounts } = await classroom();
    const o = await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200);
    const helping = o.reasons.find((r) => r.label === "Giúp bạn")!;
    const ids = accounts.map((a) => a.id);
    const r = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: ids, delta: 5, reasonId: helping.id }), 201);
    expect(r.events.map((e) => [e.reason, e.category, e.delta])).toEqual(ids.map(() => ["Giúp bạn", "yeu_thuong", 5]));
    const after = await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200);
    expect(after.stats).toMatchObject({ totalPoints: 15, todayPoints: 15, kindness: 3 });
    expect(after.weekTop.map((x) => x.points)).toEqual([5, 5, 5]);

    expect(await json(await t.del(`/api/t/classes/${cls.id}/points/batch/${r.batchId}`), 200)).toEqual({ removed: 3 });
    expect((await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200)).stats.totalPoints).toBe(0);
  });

  it("reports level-ups and new badges, so the screen can celebrate", async () => {
    const { t, cls, accounts } = await classroom();
    const id = accounts[0]!.id;
    const first = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [id], delta: 5 }), 201);
    expect(first.levelUps).toEqual([]);
    expect(first.newBadges).toEqual([{ studentId: id, key: "first_star" }]);
    const second = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [id], delta: 5 }), 201);
    expect(second.levelUps).toEqual([{ studentId: id, fullName: "Nguyễn Văn An", level: 2 }]);
    expect(second.newBadges).toEqual([]);
  });

  it("minus points never take a level away", async () => {
    const { t, cls, accounts } = await classroom();
    const id = accounts[0]!.id;
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [id], delta: 20 });
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [id], delta: -5 });
    const s = (await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200))[0]!;
    expect(s).toMatchObject({ points: 15, drops: 20, level: 2 });
  });

  it("'Thêm lý do' names the reason of a quick tap from the history", async () => {
    const { t, cls, accounts } = await classroom();
    const r = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[1]!.id], delta: 2 }), 201);
    const reasons = await json<Reason[]>(await t.get(`/api/t/classes/${cls.id}/reasons`), 200);
    const speak = reasons.find((x) => x.label === "Phát biểu")!;
    const ev = await json<PointEvent>(await t.patch(`/api/t/points/${r.events[0]!.id}`, { reasonId: speak.id }), 200);
    expect(ev).toMatchObject({ reason: "Phát biểu", category: "hoc_tap", delta: 2 });
    const history = await json<PointEvent[]>(await t.get(`/api/t/classes/${cls.id}/points?studentId=${accounts[1]!.id}`), 200);
    expect(history.map((h) => h.reason)).toEqual(["Phát biểu"]);
  });

  it("refuses students or reasons from another class", async () => {
    const { t, cls, accounts } = await classroom();
    const other = await makeClass(t, { name: "Lớp 4B" });
    expect((await t.post(`/api/t/classes/${other.id}/points`, { studentIds: [accounts[0]!.id], delta: 1 })).status).toBe(400);
    const theirReasons = await json<Reason[]>(await t.get(`/api/t/classes/${other.id}/reasons`), 200);
    const res = await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 1, reasonId: theirReasons[0]!.id });
    expect(res.status).toBe(400);
    const stranger = await teacher("cob");
    expect((await stranger.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 1 })).status).toBe(404);
  });

  it("adds, renames and archives reasons; archived ones leave history untouched", async () => {
    const { t, cls, accounts } = await classroom();
    const created = await json<Reason>(
      await t.post(`/api/t/classes/${cls.id}/reasons`, { label: "Đọc sách hay", emoji: "📖", category: "hoc_tap", kind: "plus" }),
      201,
    );
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 3, reasonId: created.id });
    await t.patch(`/api/t/reasons/${created.id}`, { label: "Mọt sách", emoji: "📚", category: "hoc_tap", kind: "plus" });
    expect((await t.del(`/api/t/reasons/${created.id}`)).status).toBe(204);
    const reasons = await json<Reason[]>(await t.get(`/api/t/classes/${cls.id}/reasons`), 200);
    expect(reasons.some((r) => r.id === created.id)).toBe(false);
    const history = await json<PointEvent[]>(await t.get(`/api/t/classes/${cls.id}/points`), 200);
    expect(history[0]!.reason).toBe("Đọc sách hay");
  });

  it("rejects zero, huge, or empty awards", async () => {
    const { t, cls, accounts } = await classroom();
    for (const body of [
      { studentIds: [accounts[0]!.id], delta: 0 },
      { studentIds: [accounts[0]!.id], delta: 100 },
      { studentIds: [], delta: 1 },
    ]) {
      expect((await t.post(`/api/t/classes/${cls.id}/points`, body)).status).toBe(400);
    }
  });
});
