import { describe, expect, it } from "vitest";
import type { EarnedBadge, Redemption, Reward, StudentHome, StudentProfile } from "@lhhp/shared";
import { classroom, json, signIn } from "./helpers";

/**
 * Đổi thưởng is hers, in front of the child: she picks the reward and its price, and hands it over.
 * "Ở trang PH và HS bỏ phần đổi thưởng" (brief 3, item 4).
 */
describe("đổi thưởng", () => {
  it("the teacher hands a reward over and the drops are taken, once the child has them", async () => {
    const { t, cls, accounts } = await classroom();
    const an = accounts[0]!;
    const sticker = (await json<Reward[]>(await t.get(`/api/t/classes/${cls.id}/rewards`), 200)).find((r) => r.cost === 20)!;

    const tooSoon = await t.post(`/api/t/classes/${cls.id}/redemptions`, { studentId: an.id, rewardId: sticker.id });
    expect(tooSoon.status).toBe(400);
    expect(await tooSoon.json()).toMatchObject({ error: { code: "not_enough_stars" } });

    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an.id], delta: 20 });
    const given = await json<Redemption>(
      await t.post(`/api/t/classes/${cls.id}/redemptions`, { studentId: an.id, rewardId: sticker.id }),
      201,
    );
    expect(given).toMatchObject({ status: "approved", cost: 20, fullName: "Nguyễn Văn An" });
    expect((await json<StudentProfile>(await t.get(`/api/t/students/${an.id}`), 200)).available).toBe(0);

    // And she can't hand the same one over twice on the same 20 drops.
    expect((await t.post(`/api/t/classes/${cls.id}/redemptions`, { studentId: an.id, rewardId: sticker.id })).status).toBe(400);
  });

  /**
   * "Chú ý nước mất đi k làm cây nhỏ lại, HS sẽ phải cố gắng thêm nhiều hơn để cây tiếp tục lớn tiếp."
   * The plant counts drops earned; a reward costs the balance.
   */
  it("spending drops never shrinks the plant", async () => {
    const { t, cls, accounts } = await classroom();
    const an = accounts[0]!;
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an.id], delta: 20 });
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [an.id], delta: 20 });
    const before = await json<StudentProfile>(await t.get(`/api/t/students/${an.id}`), 200);
    expect(before.level.level).toBe(2); // Nảy mầm, from 10 drops

    const sticker = (await json<Reward[]>(await t.get(`/api/t/classes/${cls.id}/rewards`), 200)).find((r) => r.cost === 20)!;
    await json(await t.post(`/api/t/classes/${cls.id}/redemptions`, { studentId: an.id, rewardId: sticker.id }), 201);

    const after = await json<StudentProfile>(await t.get(`/api/t/students/${an.id}`), 200);
    expect(after.level.level).toBe(before.level.level);
    expect(after.student.drops).toBe(40);
    expect(after.available).toBe(20);
  });

  it("a family cannot shop: the reward screens are the teacher's alone", async () => {
    const { t, cls, accounts } = await classroom();
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 50 });
    const sticker = (await json<Reward[]>(await t.get(`/api/t/classes/${cls.id}/rewards`), 200)).find((r) => r.cost === 20)!;
    const s = await signIn(accounts[0]!);
    expect((await s.get("/api/s/rewards")).status).toBe(404);
    expect((await s.post(`/api/s/rewards/${sticker.id}/redeem`)).status).toBe(404);
    expect((await s.get(`/api/t/classes/${cls.id}/rewards`)).status).toBe(401);
    // Nothing on the family's home screen invites them to spend.
    expect(await (await s.get("/api/s/home")).clone().text()).not.toContain("đổi quà");
  });

  it("she writes the shop herself: what it is and what it costs", async () => {
    const { t, cls } = await classroom();
    const created = await json<Reward>(
      await t.post(`/api/t/classes/${cls.id}/rewards`, { name: "Ngồi bàn đầu 1 ngày", emoji: "🪑", cost: 15 }),
      201,
    );
    expect(created).toMatchObject({ name: "Ngồi bàn đầu 1 ngày", cost: 15, active: true });
    await json(await t.patch(`/api/t/rewards/${created.id}`, { cost: 25, active: false }), 200);
    expect((await json<Reward[]>(await t.get(`/api/t/classes/${cls.id}/rewards`), 200)).find((r) => r.id === created.id)).toMatchObject({
      cost: 25,
      active: false,
    });
    expect((await t.del(`/api/t/rewards/${created.id}`)).status).toBe(204);
  });
});

describe("badges", () => {
  it("the teacher awards a badge to several students; auto badges can't be handed out", async () => {
    const { t, cls, accounts } = await classroom();
    const ids = accounts.slice(0, 2).map((a) => a.id);
    expect(await json(await t.post(`/api/t/classes/${cls.id}/badges`, { studentIds: ids, badgeKey: "reader", note: "Đọc 5 cuốn sách" }), 201)).toEqual({ awarded: 2 });
    expect((await t.post(`/api/t/classes/${cls.id}/badges`, { studentIds: ids, badgeKey: "stars_100" })).status).toBe(400);
    const s = await signIn(accounts[0]!);
    const { earned } = await json<{ earned: EarnedBadge[] }>(await s.get("/api/s/badges"), 200);
    expect(earned).toEqual([expect.objectContaining({ key: "reader", name: "Mọt sách nhí", source: "teacher", note: "Đọc 5 cuốn sách" })]);
    await t.del(`/api/t/students/${accounts[0]!.id}/badges/reader`);
    expect((await json<{ earned: EarnedBadge[] }>(await s.get("/api/s/badges"), 200)).earned).toEqual([]);
  });

  it("awards the drop and kindness badges automatically", async () => {
    const { t, cls, accounts } = await classroom();
    const reasons = await json<{ id: number; label: string }[]>(await t.get(`/api/t/classes/${cls.id}/reasons`), 200);
    const kind = reasons.find((r) => r.label === "Việc tốt")!;
    for (let i = 0; i < 5; i++) await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 1, reasonId: kind.id });
    const s = await signIn(accounts[0]!);
    const { earned } = await json<{ earned: EarnedBadge[] }>(await s.get("/api/s/badges"), 200);
    expect(earned.map((b) => b.key).sort()).toEqual(["first_star", "kind_heart"]);
  });

  /** The three badges that counted homework are now hers to give, so a child can still receive one. */
  it("lets her give the badges that used to come from quizzes", async () => {
    const { t, cls, accounts } = await classroom();
    expect(
      await json(await t.post(`/api/t/classes/${cls.id}/badges`, { studentIds: [accounts[0]!.id], badgeKey: "math_5" }), 201),
    ).toEqual({ awarded: 1 });
    const s = await signIn(accounts[0]!);
    const home = await json<StudentHome>(await s.get("/api/s/home"), 200);
    expect(home.profile.badges.map((b) => b.key)).toContain("math_5");
  });
});
