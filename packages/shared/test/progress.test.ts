import { describe, expect, it } from "vitest";
import { BADGES, ENDLESS_STEP, LEVELS, autoBadgeKeys, levelFor, levelInfo } from "../src/progress";

/**
 * The ladder she wrote on 24 September 2026, after seeing the first one:
 *
 *   "hạt giống → nảy mầm (10 giọt) → hai lá mầm (50) → lá con (100) → cây con (150) → cây xanh tốt (200)
 *    → cây ra nụ (250) → cây nở hoa (300) - cây có quả (400)"
 *   "800 giọt hs è khóc ngất vì kb bao giờ cây ra hoa. Haha"
 *   "500 quả chín. Sau 500 cây tự thêm level mỗi lần thêm 100 giọt (vẫn hiện quả đỏ k thay đổi giao diện
 *    chỉ thay đổi lv)"
 */
describe("the ladder she wrote", () => {
  it("is exactly her numbers", () => {
    expect(LEVELS.map((l) => [l.name, l.min])).toEqual([
      ["Hạt giống", 0],
      ["Nảy mầm", 10],
      ["Hai lá mầm", 50],
      ["Lá con", 100],
      ["Cây con", 150],
      ["Cây xanh tốt", 200],
      ["Cây ra nụ", 250],
      ["Cây nở hoa", 300],
      ["Cây có quả", 400],
      ["Quả chín", 500],
    ]);
  });

  it("flowers at 300, not 800 — nobody cries waiting for it", () => {
    expect(levelFor(299).name).toBe("Cây ra nụ");
    expect(levelFor(300).name).toBe("Cây nở hoa");
    expect(levelFor(400).name).toBe("Cây có quả");
    expect(levelFor(500).name).toBe("Quả chín");
  });
});

describe("levelFor", () => {
  it("starts every child as a seed", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, name: "Hạt giống", next: { level: 2, min: 10 }, toNext: 10 });
  });

  it("climbs with the drops a child has earned", () => {
    expect(levelFor(10).level).toBe(2);
    expect(levelFor(99).level).toBe(3);
    expect(levelFor(100)).toMatchObject({ level: 4, name: "Lá con" });
    expect(levelFor(150).level).toBe(5);
    expect(levelFor(250).level).toBe(7);
  });

  it("reports progress within the level as 0 to 1", () => {
    expect(levelFor(30).progress).toBeCloseTo(0.5);
    expect(levelFor(125).progress).toBeCloseTo(0.5);
  });

  it("stays on the last picture it reached; a stage is never half-drawn", () => {
    for (let d = 0; d < 900; d++) {
      const l = levelFor(d);
      expect(d).toBeGreaterThanOrEqual(l.min);
      expect(l.progress).toBeGreaterThanOrEqual(0);
      expect(l.progress).toBeLessThan(1);
    }
  });

  it("never goes backwards as a child earns more", () => {
    let last = 0;
    for (let d = 0; d <= 3000; d += 7) {
      expect(levelFor(d).level).toBeGreaterThanOrEqual(last);
      last = levelFor(d).level;
    }
  });
});

describe("after the fruit ripens", () => {
  it("gains a level every hundred drops, for ever", () => {
    expect(ENDLESS_STEP).toBe(100);
    expect(levelFor(500).level).toBe(10);
    expect(levelFor(599).level).toBe(10);
    expect(levelFor(600).level).toBe(11);
    expect(levelFor(700).level).toBe(12);
    expect(levelFor(1500).level).toBe(20);
    expect(levelFor(10_000).level).toBe(105);
  });

  it("keeps the ripe fruit: only the number changes", () => {
    const ripe = levelFor(500);
    for (const drops of [600, 900, 2400, 10_000]) {
      expect(levelFor(drops).name).toBe(ripe.name);
      expect(levelFor(drops).emoji).toBe(ripe.emoji);
    }
  });

  it("always has another hundred to aim at, so the bar never sticks full", () => {
    for (const drops of [500, 640, 999, 5000]) {
      const l = levelFor(drops);
      expect(l.next).not.toBeNull();
      expect(l.next!.level).toBe(l.level + 1);
      expect(l.toNext).toBeGreaterThan(0);
      expect(l.toNext).toBeLessThanOrEqual(100);
      // toNext counts from where the child is now, not from the level's floor.
      expect(drops + l.toNext).toBe(l.next!.min);
    }
    expect(levelFor(640).toNext).toBe(60);
    expect(levelFor(640).progress).toBeCloseTo(0.4);
  });
});

describe("levelInfo", () => {
  it("names any level, including the ones past the drawn stages", () => {
    expect(levelInfo(1)).toMatchObject({ level: 1, name: "Hạt giống" });
    expect(levelInfo(10)).toMatchObject({ level: 10, name: "Quả chín", min: 500 });
    expect(levelInfo(11)).toMatchObject({ level: 11, name: "Quả chín", min: 600 });
    expect(levelInfo(25)).toMatchObject({ level: 25, name: "Quả chín", min: 2000 });
  });

  it("agrees with levelFor at every threshold", () => {
    for (let n = 1; n <= 30; n++) {
      const info = levelInfo(n);
      expect(levelFor(info.min)).toMatchObject({ level: n, name: info.name, emoji: info.emoji });
    }
  });

  it("holds the line at level 1 for anything odd", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(-4).level).toBe(1);
  });
});

describe("autoBadgeKeys", () => {
  const none = { drops: 0, kindness: 0 };

  it("awards nothing to a new student", () => {
    expect(autoBadgeKeys(none)).toEqual([]);
  });

  it("awards badges as their thresholds are met", () => {
    expect(autoBadgeKeys({ ...none, drops: 1 })).toEqual(["first_star"]);
    expect(autoBadgeKeys({ drops: 120, kindness: 5 }).sort()).toEqual(
      ["first_star", "stars_50", "stars_100", "kind_heart"].sort(),
    );
  });

  /** The two top badges marked 350 and 550, which are no longer anything on the ladder. */
  it("follows the new plant: a badge at the blossom and one at the ripe fruit", () => {
    expect(autoBadgeKeys({ ...none, drops: 299 })).not.toContain("stars_350");
    expect(autoBadgeKeys({ ...none, drops: 300 })).toContain("stars_350");
    expect(autoBadgeKeys({ ...none, drops: 499 })).not.toContain("stars_550");
    expect(autoBadgeKeys({ ...none, drops: 500 })).toContain("stars_550");
  });

  it("describes every automatic badge with the number that actually earns it", () => {
    const thresholds: Record<string, number> = { stars_50: 50, stars_100: 100, stars_200: 200, stars_350: 300, stars_550: 500 };
    for (const [key, drops] of Object.entries(thresholds)) {
      const badge = BADGES.find((b) => b.key === key)!;
      expect(badge.description, key).toContain(String(drops));
      expect(autoBadgeKeys({ ...none, drops })).toContain(key);
      expect(autoBadgeKeys({ ...none, drops: drops - 1 })).not.toContain(key);
    }
  });

  it("counts kindness twice over: 5 times, then 20", () => {
    expect(autoBadgeKeys({ ...none, kindness: 5 })).toEqual(["kind_heart"]);
    expect(autoBadgeKeys({ ...none, kindness: 20 }).sort()).toEqual(["kind_heart", "kind_20"].sort());
  });

  /**
   * Children no longer hand work in through the app (brief 3, item 2), so the three badges that counted
   * submissions are hers to give by hand. Nothing awards them automatically any more.
   */
  it("no longer awards the badges that counted homework", () => {
    const everything = autoBadgeKeys({ drops: 1e6, kindness: 1e6 });
    expect(everything).not.toContain("math_5");
    expect(everything).not.toContain("viet_5");
    expect(everything).not.toContain("perfect_quiz");
    for (const key of ["math_5", "viet_5", "perfect_quiz"]) {
      expect(BADGES.find((b) => b.key === key), `${key} must stay in the list so a child who holds it keeps it`).toMatchObject({ auto: false });
    }
  });

  it("every badge key is unique and every auto rule names a real badge", () => {
    const keys = BADGES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    const all = autoBadgeKeys({ drops: 1e6, kindness: 1e6 });
    for (const k of all) expect(keys).toContain(k);
    for (const b of BADGES.filter((x) => x.auto)) expect(all).toContain(b.key);
  });
});
