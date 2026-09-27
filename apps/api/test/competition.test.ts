import { describe, expect, it } from "vitest";
import type { BadgeDef, ClassOverview, CompetitionEntry, EarnedBadge, FamilyHonourBoard, SchoolRanking } from "@lhhp/shared";
import { addStudents, classroom, client, fixedNow, json, makeClass, signIn, teacher } from "./helpers";

/**
 * Brief 12 (25 September 2026): Vinh danh becomes Thi đua. "Kết quả thi đua của các lớp trong trường, xếp loại điểm
 * từ cao đến thấp… riêng lớp 4C luôn là cột màu đỏ", badges whose "icon và nội dung GV có thể chỉnh sửa", and all of it
 * on the family's side "cho PH thấy vị trí của con mình trong tuần qua… đồng thời biết đc vị trí của lớp trong trường".
 */

const NOW = fixedNow("2026-09-24T03:00:00Z"); // Thursday 24 September 2026
const WEEK = [
  { name: "Lớp 4A", score: 95, isOurs: false },
  { name: "Lớp 4C", score: 97.5, isOurs: true },
  { name: "Lớp 4B", score: 99, isOurs: false },
  { name: "Lớp 5A", score: 90, isOurs: false },
];

describe("kết quả thi đua của trường", () => {
  it("she enters the school's results for a week; they come back sorted from the highest, hers marked", async () => {
    const { t, cls } = await classroom(NOW);
    const saved = await json<SchoolRanking>(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-24", rows: WEEK }), 200);
    expect(saved.rows.map((r) => [r.name, r.score, r.isOurs])).toEqual([
      ["Lớp 4B", 99, false],
      ["Lớp 4C", 97.5, true],
      ["Lớp 4A", 95, false],
      ["Lớp 5A", 90, false],
    ]);
    expect(saved.periodKey).toBe("2026-09-21");
    const again = await json<SchoolRanking>(await t.get(`/api/t/classes/${cls.id}/competition?period=week&date=2026-09-26`), 200);
    expect(again.rows).toEqual(saved.rows);
  });

  it("a month is kept apart from its weeks, and saving again replaces the list", async () => {
    const { t, cls } = await classroom(NOW);
    await json(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-24", rows: WEEK }), 200);
    const month = await json<SchoolRanking>(await t.get(`/api/t/classes/${cls.id}/competition?period=month&date=2026-09-24`), 200);
    expect(month.rows).toEqual([]);
    await json(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-22", rows: WEEK.slice(0, 2) }), 200);
    const week = await json<SchoolRanking>(await t.get(`/api/t/classes/${cls.id}/competition?period=week&date=2026-09-24`), 200);
    expect(week.rows).toHaveLength(2);
  });

  it("an empty week offers last time's classes, so she only types the scores", async () => {
    const { t, cls } = await classroom(NOW);
    await json(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-17", rows: WEEK }), 200);
    const next = await json<SchoolRanking>(await t.get(`/api/t/classes/${cls.id}/competition?period=week&date=2026-09-24`), 200);
    expect(next.rows).toEqual([]);
    expect(next.lastNames).toEqual([
      { name: "Lớp 4B", isOurs: false },
      { name: "Lớp 4C", isOurs: true },
      { name: "Lớp 4A", isOurs: false },
      { name: "Lớp 5A", isOurs: false },
    ]);
  });

  it("her class is exactly one row, a score is a number from 0 to 10000, and a name is not blank", async () => {
    const { t, cls } = await classroom(NOW);
    const put = (rows: unknown) => t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-24", rows });
    expect((await put([{ name: "Lớp 4A", score: 9, isOurs: false }])).status).toBe(400);
    expect((await put([{ name: "Lớp 4A", score: 9, isOurs: true }, { name: "Lớp 4C", score: 9, isOurs: true }])).status).toBe(400);
    expect((await put([{ name: "Lớp 4C", score: -1, isOurs: true }])).status).toBe(400);
    expect((await put([{ name: "Lớp 4C", score: 10001, isOurs: true }])).status).toBe(400);
    expect((await put([{ name: "  ", score: 9, isOurs: true }])).status).toBe(400);
  });

  it("she can clear a week", async () => {
    const { t, cls } = await classroom(NOW);
    await json(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-24", rows: WEEK }), 200);
    expect((await t.del(`/api/t/classes/${cls.id}/competition?period=week&date=2026-09-24`)).status).toBe(204);
    expect((await json<SchoolRanking>(await t.get(`/api/t/classes/${cls.id}/competition?period=week&date=2026-09-24`), 200)).rows).toEqual([]);
  });

  it("the family sees the same chart, read-only, and never another class's", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    await json(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-24", rows: WEEK }), 200);
    const s = await signIn(accounts[0]!, NOW);
    const seen = await json<SchoolRanking>(await s.get("/api/s/competition?period=week&date=2026-09-24"), 200);
    expect(seen.rows.map((r) => r.name)).toEqual(["Lớp 4B", "Lớp 4C", "Lớp 4A", "Lớp 5A"]);
    expect(seen.lastNames).toBeUndefined();
    expect((await s.put(`/api/t/classes/${cls.id}/competition`, { period: "week", rows: WEEK })).status).toBe(401);

    const other = await teacher("cob", NOW);
    const otherClass = await makeClass(other, { name: "Lớp 5B" });
    expect((await other.get(`/api/t/classes/${cls.id}/competition?period=week`)).status).toBe(404);
    expect((await other.put(`/api/t/classes/${cls.id}/competition`, { period: "week", rows: WEEK })).status).toBe(404);
    const [stranger] = await addStudents(other, otherClass.id, ["Người Lạ"]);
    const theirs = await json<SchoolRanking>(await (await signIn(stranger!, NOW)).get("/api/s/competition?period=week&date=2026-09-24"), 200);
    expect(theirs.rows).toEqual([]);
    expect((await client().get("/api/s/competition?period=week")).status).toBe(401);
  });
});

describe("the family's Vinh danh: where the child stands in the class", () => {
  it("gives the child's own rank and drops for the week, and the Top 10 when she lets families see it", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const [an, ngoc, duc] = accounts;
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [ngoc!.id], delta: 5 });
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an!.id], delta: 3 });
    const s = await signIn(an!, NOW);
    const board = await json<FamilyHonourBoard>(await s.get("/api/s/honours/board?period=week&date=2026-09-24"), 200);
    expect(board.me).toMatchObject({ rank: 2, points: 3, of: 3 });
    expect(board.leaders!.map((l) => l.fullName)).toEqual(["Trần Bảo Ngọc", "Nguyễn Văn An"]);

    // Brief 15: "Nguyễn Minh Anh 123 giọt nước Tuần này 20 giọt nước" — the total beside the week, for each child.
    expect(board.leaders!.map((l) => [l.points, l.total])).toEqual([
      [5, 5],
      [3, 3],
    ]);
    expect(board.me.total).toBe(3);

    // A child with no drops yet is not ranked, and is told so rather than shown last.
    const d = await signIn(duc!, NOW);
    expect((await json<FamilyHonourBoard>(await d.get("/api/s/honours/board?period=week&date=2026-09-24"), 200)).me).toEqual({ rank: null, points: 0, total: 0, of: 3 });

    // She hides the Top 10 in Cài đặt: the family still sees its own place, and nobody else's.
    await t.patch(`/api/t/classes/${cls.id}`, { showLeaderboard: false });
    const hidden = await json<FamilyHonourBoard>(await s.get("/api/s/honours/board?period=week&date=2026-09-24"), 200);
    expect(hidden.leaders).toBeNull();
    expect(hidden.me.rank).toBe(2);
  });
});

describe("huy hiệu she can rename", () => {
  it("changes a badge's icon, name and description for her class only, everywhere it shows", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const defs = await json<BadgeDef[]>(await t.get(`/api/t/classes/${cls.id}/badge-defs`), 200);
    const reader = defs.find((b) => b.key === "reader")!;
    expect(reader.name).toBe("Mọt sách nhí");

    const edited = await json<BadgeDef>(
      await t.put(`/api/t/classes/${cls.id}/badge-defs/reader`, { emoji: "📚", name: "Bạn đọc chăm chỉ", description: "Đọc hết 5 cuốn sách" }),
      200,
    );
    expect(edited).toMatchObject({ key: "reader", emoji: "📚", name: "Bạn đọc chăm chỉ", auto: false });

    // In the overview, on the child's page and on the family's side.
    const o = await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200);
    expect(o.badgeDefs.find((b) => b.key === "reader")!.name).toBe("Bạn đọc chăm chỉ");
    await json(await t.post(`/api/t/classes/${cls.id}/badges`, { badgeKey: "reader", studentIds: [accounts[0]!.id] }), 201);
    const s = await signIn(accounts[0]!, NOW);
    const mine = await json<{ all: BadgeDef[]; earned: EarnedBadge[] }>(await s.get("/api/s/badges"), 200);
    expect(mine.earned.find((b) => b.key === "reader")).toMatchObject({ emoji: "📚", name: "Bạn đọc chăm chỉ" });

    // Another class keeps the default.
    const other = await teacher("cob", NOW);
    const otherClass = await makeClass(other, { name: "Lớp 5B" });
    const theirs = await json<BadgeDef[]>(await other.get(`/api/t/classes/${otherClass.id}/badge-defs`), 200);
    expect(theirs.find((b) => b.key === "reader")!.name).toBe("Mọt sách nhí");
    expect((await other.put(`/api/t/classes/${cls.id}/badge-defs/reader`, { emoji: "📚", name: "X", description: "" })).status).toBe(404);
  });

  it("an automatic badge keeps its milestone; an unknown badge or a blank name is refused", async () => {
    const { t, cls } = await classroom(NOW);
    const edited = await json<BadgeDef>(
      await t.put(`/api/t/classes/${cls.id}/badge-defs/stars_50`, { emoji: "🌟", name: "Siêu chăm", description: "Đạt 50 giọt nước" }),
      200,
    );
    expect(edited.auto).toBe(true);
    expect((await t.put(`/api/t/classes/${cls.id}/badge-defs/__proto__`, { emoji: "🌟", name: "X", description: "" })).status).toBe(404);
    expect((await t.put(`/api/t/classes/${cls.id}/badge-defs/reader`, { emoji: "🌟", name: " ", description: "" })).status).toBe(400);
  });
});

describe("the family's week: total and this week side by side (brief 15)", () => {
  it("counts drops from before this week in the total, and only this week's in the week", async () => {
    const earlier = fixedNow("2026-09-15T03:00:00Z");
    const { t, cls, accounts } = await classroom(earlier);
    const an = accounts[0]!;
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an.id], delta: 10 });
    // A week later, with the same class's teacher.
    const tNow = client(NOW);
    tNow.cookie = t.cookie;
    await tNow.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an.id], delta: 4 });
    await tNow.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an.id], delta: -1 });
    const s = await signIn(an, NOW);
    const board = await json<FamilyHonourBoard>(await s.get("/api/s/honours/board?period=week&date=2026-09-24"), 200);
    expect(board.me).toMatchObject({ rank: 1, points: 3, total: 13 });
    expect(board.leaders![0]).toMatchObject({ fullName: "Nguyễn Văn An", points: 3, total: 13 });
  });
});

describe("school weeks by name, and only the weeks she entered (brief 18)", () => {
  it("names a week the way she does, and lists the periods she has entered, newest first", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const empty = await json<CompetitionEntry[]>(await t.get(`/api/t/classes/${cls.id}/competition/entered`), 200);
    expect(empty).toEqual([]);

    const saved = await json<SchoolRanking>(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-16", rows: WEEK }), 200);
    expect(saved.periodLabel).toBe("Tuần 2 (14/09 – 18/09)");
    await json(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "week", date: "2026-09-23", rows: WEEK }), 200);
    await json(await t.put(`/api/t/classes/${cls.id}/competition`, { period: "month", date: "2026-09-10", rows: WEEK }), 200);

    const entered = await json<CompetitionEntry[]>(await t.get(`/api/t/classes/${cls.id}/competition/entered`), 200);
    expect(entered).toEqual([
      { period: "week", periodKey: "2026-09-21", periodLabel: "Tuần 3 (21/09 – 25/09)" },
      { period: "week", periodKey: "2026-09-14", periodLabel: "Tuần 2 (14/09 – 18/09)" },
      { period: "month", periodKey: "2026-09-01", periodLabel: "Tháng 9/2026" },
    ]);

    // The family gets the same list — only what she entered — and never another class's.
    const s = await signIn(accounts[0]!, NOW);
    expect(await json<CompetitionEntry[]>(await s.get("/api/s/competition/entered"), 200)).toEqual(entered);
    const other = await teacher("cob", NOW);
    expect((await other.get(`/api/t/classes/${cls.id}/competition/entered`)).status).toBe(404);
    const otherClass = await makeClass(other, { name: "Lớp 5B" });
    const [stranger] = await addStudents(other, otherClass.id, ["Người Lạ"]);
    expect(await json<CompetitionEntry[]>(await (await signIn(stranger!, NOW)).get("/api/s/competition/entered"), 200)).toEqual([]);

    // A week cleared is a week no longer listed.
    await t.del(`/api/t/classes/${cls.id}/competition?period=week&date=2026-09-16`);
    const after = await json<CompetitionEntry[]>(await t.get(`/api/t/classes/${cls.id}/competition/entered`), 200);
    expect(after.map((e) => e.periodKey)).toEqual(["2026-09-21", "2026-09-01"]);
  });
});
