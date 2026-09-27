import { describe, expect, it } from "vitest";
import type { Honour, HonourBoard, MangNonRow, TeamRace } from "@lhhp/shared";
import { addStudents, classroom, fixedNow, json, makeClass, signIn, student, teacher } from "./helpers";

const NOW = fixedNow("2026-09-23T03:00:00Z");

describe("vinh danh", () => {
  it("ranks the week and crowns from it", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const [an, ngoc] = accounts;
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an!.id], delta: 10 });
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [ngoc!.id], delta: 4 });

    const board = await json<HonourBoard>(await t.get(`/api/t/classes/${cls.id}/honours?period=week`), 200);
    expect(board).toMatchObject({ period: "week", periodKey: "2026-09-21" });
    expect(board.leaders.map((l) => [l.fullName, l.points])).toEqual([
      ["Nguyễn Văn An", 10],
      ["Trần Bảo Ngọc", 4],
    ]);
    expect(board.given).toEqual([]);

    const given = await json<Honour[]>(await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [an!.id], period: "week" }), 201);
    expect(given).toHaveLength(1);
    expect(given[0]).toMatchObject({
      studentId: an!.id,
      fullName: "Nguyễn Văn An",
      period: "week",
      title: "Ngôi sao của tuần",
      points: 10,
    });
  });

  it("freezes the drops an honour was given for", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const id = accounts[0]!.id;
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [id], delta: 6 });
    await json(await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [id], period: "week" }), 201);
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [id], delta: 20 });

    const board = await json<HonourBoard>(await t.get(`/api/t/classes/${cls.id}/honours?period=week`), 200);
    expect(board.given[0]!.points).toBe(6);
  });

  it("crowns the same week only once, and can be undone", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const id = accounts[0]!.id;
    await json(await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [id], period: "week", note: "Chăm phát biểu" }), 201);
    const again = await json<Honour[]>(
      await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [id], period: "week", note: "Giúp bạn" }),
      201,
    );
    expect(again).toHaveLength(1);
    expect(again[0]!.note).toBe("Giúp bạn");

    expect((await t.del(`/api/t/honours/${again[0]!.id}`)).status).toBe(204);
    const board = await json<HonourBoard>(await t.get(`/api/t/classes/${cls.id}/honours?period=week`), 200);
    expect(board.given).toEqual([]);
  });

  it("keeps the week, the month, the semester and the year apart", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const id = accounts[0]!.id;
    for (const period of ["week", "month", "semester", "year"] as const) {
      await json(await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [id], period }), 201);
    }
    const wall = await json<Honour[]>(await t.get(`/api/t/classes/${cls.id}/honours/wall`), 200);
    expect(wall.map((h) => h.title).sort()).toEqual(
      ["Ngôi sao của học kỳ", "Ngôi sao của năm", "Ngôi sao của tháng", "Ngôi sao của tuần"].sort(),
    );
    expect(wall.find((h) => h.period === "year")!.periodLabel).toBe("Năm học 2026–2027");
    expect(wall.find((h) => h.period === "month")!.periodLabel).toBe("Tháng 9/2026");
  });

  it("shows the whole roll to the families", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    await json(await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [accounts[1]!.id], period: "week" }), 201);
    const s = await signIn(accounts[0]!);
    const roll = await json<Honour[]>(await s.get("/api/s/honours"), 200);
    expect(roll.map((h) => h.fullName)).toEqual(["Trần Bảo Ngọc"]);
  });

  it("shows a family only their own child once the teacher hides the Top 10", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    await t.patch(`/api/t/classes/${cls.id}`, { showLeaderboard: false });
    await json(
      await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [accounts[0]!.id, accounts[1]!.id], period: "week" }),
      201,
    );
    const s = await signIn(accounts[0]!);
    const roll = await json<Honour[]>(await s.get("/api/s/honours"), 200);
    expect(roll.map((h) => h.fullName)).toEqual(["Nguyễn Văn An"]);
  });

  it("refuses another teacher's class and another class's child", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const given = await json<Honour[]>(
      await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [accounts[0]!.id], period: "week" }),
      201,
    );
    const other = await teacher("cothu", NOW);
    const otherClass = await makeClass(other, { name: "Lớp 4B", usernameSuffix: "4b" });
    const otherKids = await addStudents(other, otherClass.id, ["Phạm Gia Huy"]);

    expect((await other.get(`/api/t/classes/${cls.id}/honours`)).status).toBe(404);
    expect((await other.del(`/api/t/honours/${given[0]!.id}`)).status).toBe(404);
    expect((await t.post(`/api/t/classes/${cls.id}/honours`, { studentIds: [otherKids[0]!.id], period: "week" })).status).toBe(404);
  });
});

describe("thi đua theo tổ", () => {
  it("ranks the tổ over a week, a month and the year", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const [an, ngoc, duc] = accounts; // tổ 1, tổ 2, tổ 1
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an!.id], delta: 5 });
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [duc!.id], delta: 3 });
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [ngoc!.id], delta: 6 });
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [ngoc!.id], delta: -2 });

    const week = await json<TeamRace>(await t.get(`/api/t/classes/${cls.id}/teams?period=week`), 200);
    expect(week.standings[0]).toMatchObject({ group: 1, members: 2, plus: 8, minus: 0, points: 8, average: 4 });
    expect(week.standings[1]).toMatchObject({ group: 2, members: 1, plus: 6, minus: 2, points: 4, average: 4 });
    // Tổ 3 and 4 exist but have nobody in them yet.
    expect(week.standings.filter((s) => s.members === 0)).toHaveLength(2);

    const year = await json<TeamRace>(await t.get(`/api/t/classes/${cls.id}/teams?period=year`), 200);
    expect(year.period.label).toBe("Năm học 2026–2027");
    expect(year.standings[0]!.points).toBe(8);
  });
});

describe("hồ sơ măng non", () => {
  it("keeps what the teacher writes about a child", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const row = await json<MangNonRow>(
      await t.patch(`/api/t/students/${accounts[0]!.id}/profile`, {
        birthday: "2017-03-12",
        gender: "nam",
        hobby: "Đá bóng, vẽ tranh",
        dream: "Làm bác sĩ",
        duty: "Lớp trưởng",
      }),
      200,
    );
    expect(row).toMatchObject({
      fullName: "Nguyễn Văn An",
      birthday: "2017-03-12",
      birthdayDm: "12/03",
      gender: "nam",
      dream: "Làm bác sĩ",
      duty: "Lớp trưởng",
      group: 1,
      teamName: "Thỏ Ngọc Chăm Chỉ",
    });

    const list = await json<MangNonRow[]>(await t.get(`/api/t/classes/${cls.id}/mang-non`), 200);
    expect(list).toHaveLength(3);
    expect(list[0]!.duty).toBe("Lớp trưởng");
  });

  it("lets a child fill in their own page, but not give themselves a chức vụ", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    await t.patch(`/api/t/students/${accounts[0]!.id}/profile`, { duty: "Tổ trưởng" });
    const s = await signIn(accounts[0]!);

    const mine = await json<MangNonRow>(
      await s.patch("/api/s/profile", { hobby: "Đọc truyện tranh", dream: "Làm phi hành gia", birthday: "2017-05-01" }),
      200,
    );
    expect(mine).toMatchObject({ hobby: "Đọc truyện tranh", dream: "Làm phi hành gia", duty: "Tổ trưởng" });

    // duty is not in the child's schema, so sending it changes nothing.
    await json(await s.patch("/api/s/profile", { duty: "Lớp trưởng" }), 200);
    const list = await json<MangNonRow[]>(await t.get(`/api/t/classes/${cls.id}/mang-non`), 200);
    expect(list[0]!.duty).toBe("Tổ trưởng");
  });

  it("shows classmates the day and month of a birthday, never the year", async () => {
    const { t, accounts } = await classroom(NOW);
    await t.patch(`/api/t/students/${accounts[1]!.id}/profile`, { birthday: "2017-11-08", hobby: "Múa" });
    const s = await signIn(accounts[0]!);
    const list = await json<MangNonRow[]>(await s.get("/api/s/mang-non"), 200);

    const friend = list.find((r) => r.id === accounts[1]!.id)!;
    expect(friend).toMatchObject({ birthday: null, birthdayDm: "08/11", hobby: "Múa" });

    await s.patch("/api/s/profile", { birthday: "2017-02-02" });
    const own = (await json<MangNonRow[]>(await s.get("/api/s/mang-non"), 200)).find((r) => r.id === accounts[0]!.id)!;
    expect(own.birthday).toBe("2017-02-02");
  });

  it("refuses a profile edit from another teacher", async () => {
    const { accounts } = await classroom(NOW);
    const other = await teacher("cothu", NOW);
    await makeClass(other, { name: "Lớp 4B", usernameSuffix: "4b" });
    expect((await other.patch(`/api/t/students/${accounts[0]!.id}/profile`, { dream: "Đổi trộm" })).status).toBe(404);
  });
});
