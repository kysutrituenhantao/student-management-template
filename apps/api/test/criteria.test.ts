import { describe, expect, it } from "vitest";
import type { ClassOverview, PointsResult, Reason } from "@lhhp/shared";
import { classroom, json, teacher, makeClass } from "./helpers";

/**
 * Brief 7: "tiêu chí cộng điểm và trừ điểm… hiển thị tiêu chí và điểm giọt nước. Ví dụ: Chăm chỉ cộng 2 giọt nước;
 * Không làm BT trừ 2 giọt nước. Phần này liên kết sang phần thêm điểm hoặc trừ điểm cho HS ở trang chủ."
 */
describe("criteria worth a number of drops", () => {
  it("every criterion has its drops; those she hasn't set are worth 1", async () => {
    const { t, cls } = await classroom();
    const reasons = await json<Reason[]>(await t.get(`/api/t/classes/${cls.id}/reasons`), 200);
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) expect(r.drops).toBe(1);
    const o = await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200);
    expect(o.reasons.every((r) => r.drops === 1)).toBe(true);
  });

  it("her examples: Chăm chỉ becomes 2, Không làm BT is added at 2, and both come back so", async () => {
    const { t, cls } = await classroom();
    const reasons = await json<Reason[]>(await t.get(`/api/t/classes/${cls.id}/reasons`), 200);
    const hard = reasons.find((r) => r.label === "Chăm chỉ")!;
    const edited = await json<Reason>(await t.patch(`/api/t/reasons/${hard.id}`, { ...hard, drops: 2 }), 200);
    expect(edited.drops).toBe(2);
    const added = await json<Reason>(
      await t.post(`/api/t/classes/${cls.id}/reasons`, { label: "Không làm BT", emoji: "📝", category: "hoc_tap", kind: "minus", drops: 2 }),
      201,
    );
    expect(added).toMatchObject({ label: "Không làm BT", kind: "minus", drops: 2 });
    const again = await json<Reason[]>(await t.get(`/api/t/classes/${cls.id}/reasons`), 200);
    expect(again.find((r) => r.id === hard.id)!.drops).toBe(2);
    expect(again.find((r) => r.id === added.id)!.drops).toBe(2);
  });

  it("a number of drops is a whole number from 1 to 20", async () => {
    const { t, cls } = await classroom();
    const base = { label: "Thử", emoji: "⭐", category: "hoc_tap", kind: "plus" };
    for (const drops of [0, -2, 21, 1.5]) {
      expect((await t.post(`/api/t/classes/${cls.id}/reasons`, { ...base, drops })).status, String(drops)).toBe(400);
    }
    // Left out, it is 1.
    expect((await json<Reason>(await t.post(`/api/t/classes/${cls.id}/reasons`, base), 201)).drops).toBe(1);
  });

  it("scoring with a criterion gives its drops, with its sign, and names it in the history", async () => {
    const { t, cls, accounts } = await classroom();
    const plus = await json<Reason>(
      await t.post(`/api/t/classes/${cls.id}/reasons`, { label: "Chăm chỉ lắm", emoji: "📚", category: "hoc_tap", kind: "plus", drops: 2 }),
      201,
    );
    const minus = await json<Reason>(
      await t.post(`/api/t/classes/${cls.id}/reasons`, { label: "Không làm BT", emoji: "📝", category: "hoc_tap", kind: "minus", drops: 2 }),
      201,
    );
    const sid = accounts[0]!.id;
    const a = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [sid], delta: 2, reasonId: plus.id }), 201);
    expect(a.events[0]).toMatchObject({ delta: 2, reason: "Chăm chỉ lắm" });
    const b = await json<PointsResult>(await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [sid], delta: -2, reasonId: minus.id }), 201);
    expect(b.events[0]).toMatchObject({ delta: -2, reason: "Không làm BT" });
    // A minus criterion never adds, and a plus one never takes away.
    expect((await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [sid], delta: 2, reasonId: minus.id })).status).toBe(400);
    expect((await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [sid], delta: -1, reasonId: plus.id })).status).toBe(400);
  });

  it("another teacher can neither see, change nor remove them", async () => {
    const { t, cls } = await classroom();
    const [r] = await json<Reason[]>(await t.get(`/api/t/classes/${cls.id}/reasons`), 200);
    const other = await teacher("cob");
    await makeClass(other, { name: "Lớp 4B" });
    expect((await other.get(`/api/t/classes/${cls.id}/reasons`)).status).toBe(404);
    expect((await other.patch(`/api/t/reasons/${r!.id}`, { ...r, drops: 5 })).status).toBe(404);
    expect((await other.del(`/api/t/reasons/${r!.id}`)).status).toBe(404);
    expect((await other.post(`/api/t/classes/${cls.id}/reasons`, { label: "X", emoji: "⭐", category: "hoc_tap", kind: "plus", drops: 1 })).status).toBe(404);
  });
});
