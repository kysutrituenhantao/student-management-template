import { describe, expect, it } from "vitest";
import {
  DUCK_RACE_MAX_MS,
  DUCK_RACE_MIN_MS,
  HAT_TAP_MAX_MS,
  HAT_TAP_MIN_MS,
  WHEEL_TURNS_MAX,
  WHEEL_TURNS_MIN,
  duckRace,
  hatTapMs,
  laneAt,
  wheelSpin,
} from "../src/games";

/**
 * How the "gọi tên ngẫu nhiên" games move, as she wrote it down. Brief 14 (26/09) rewrote brief 4's numbers:
 * "Vòng quay may mắn: tạo hiệu ứng quay 3-4 vòng rồi chậm dần ở tên bạn được chọn", "Chiếc mũ bí mật: … có 1 bàn tay
 * gõ vào chiếc mũ khoảng 3-5s sau tên hiện lên", "Đua vịt: cả lớp cùng đua… cuộc đua khoảng 5s, có chú vịt lên trước
 * có chú vịt rớt lại phía sau, tạo sự hồi hộp".
 */

/** A random() that walks a fixed list, so a spin or a race can be replayed exactly. */
const from = (xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
};

/** A small seeded generator, for properties that need many races with honest-looking randomness. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("vòng quay may mắn", () => {
  it("turns three to four times", () => {
    expect(WHEEL_TURNS_MIN).toBe(3);
    expect(WHEEL_TURNS_MAX).toBe(4);
    for (let count = 1; count <= 40; count++) {
      for (let r = 0; r < 20; r++) {
        const spin = wheelSpin({ count, from: 0, random: from([r / 20]) })!;
        expect(spin.turns).toBeGreaterThanOrEqual(3);
        expect(spin.turns).toBeLessThan(4);
      }
    }
  });

  it("stops with the winner's slice under the pointer at the top", () => {
    const count = 8;
    const slice = 360 / count;
    for (let pick = 0; pick < count; pick++) {
      const spin = wheelSpin({ count, from: 0, random: from([pick / count]) })!;
      expect(spin.index).toBe(pick);
      const middle = (((pick * slice + slice / 2 + spin.angle) % 360) + 360) % 360;
      expect(Math.min(middle, 360 - middle)).toBeLessThan(0.001);
    }
  });

  it("always turns forwards from where the wheel was left", () => {
    let angle = 0;
    for (let i = 0; i < 20; i++) {
      const spin = wheelSpin({ count: 6, from: angle, random: from([i / 20]) })!;
      expect(spin.angle - angle).toBeGreaterThanOrEqual(3 * 360);
      expect(spin.angle - angle).toBeLessThan(4 * 360);
      angle = spin.angle;
    }
  });

  it("takes long enough to slow down properly: five to seven seconds", () => {
    for (let r = 0; r < 20; r++) {
      const spin = wheelSpin({ count: 12, from: 0, random: from([r / 20]) })!;
      expect(spin.durationMs).toBeGreaterThanOrEqual(5000);
      expect(spin.durationMs).toBeLessThanOrEqual(7000);
    }
  });

  it("a wheel with nobody on it does not spin, and random() of 1 does not fall off the end", () => {
    expect(wheelSpin({ count: 0, from: 0, random: from([0.5]) })).toBeNull();
    expect(wheelSpin({ count: 7, from: 0, random: from([1]) })!.index).toBe(6);
  });
});

describe("chiếc mũ bí mật", () => {
  it("the hand taps for three to five seconds before the name comes out", () => {
    expect(HAT_TAP_MIN_MS).toBe(3000);
    expect(HAT_TAP_MAX_MS).toBe(5000);
    for (const r of [0, 0.25, 0.5, 0.99, 1]) {
      const ms = hatTapMs(() => r);
      expect(ms).toBeGreaterThanOrEqual(3000);
      expect(ms).toBeLessThanOrEqual(5000);
    }
  });
});

describe("đua vịt", () => {
  const ids = Array.from({ length: 35 }, (_, i) => i + 1);

  it("races the whole class, every duck with a lane that starts at the line", () => {
    const race = duckRace({ ids, random: seeded(1) })!;
    expect(race.lanes.map((l) => l.id)).toEqual(ids);
    for (const lane of race.lanes) expect(laneAt(lane, 0)).toBe(0);
  });

  it("is over in about five seconds", () => {
    expect(DUCK_RACE_MIN_MS).toBeGreaterThanOrEqual(4500);
    expect(DUCK_RACE_MAX_MS).toBeLessThanOrEqual(5500);
    for (let r = 0; r < 100; r++) {
      const race = duckRace({ ids, random: seeded(r) })!;
      expect(race.durationMs).toBeGreaterThanOrEqual(DUCK_RACE_MIN_MS);
      expect(race.durationMs).toBeLessThanOrEqual(DUCK_RACE_MAX_MS);
    }
  });

  it("the winner is home exactly as the race ends, and every other duck is still short of the line", () => {
    for (let r = 0; r < 100; r++) {
      const race = duckRace({ ids, random: seeded(r) })!;
      for (const lane of race.lanes) {
        if (lane.id === race.winner) expect(laneAt(lane, 1)).toBe(1);
        else expect(laneAt(lane, 1)).toBeLessThan(1);
      }
    }
  });

  it("never swims backwards", () => {
    const race = duckRace({ ids, random: seeded(7) })!;
    for (const lane of race.lanes) {
      for (let k = 1; k < lane.stops.length; k++) {
        expect(lane.stops[k]!.at).toBeGreaterThan(lane.stops[k - 1]!.at);
        expect(lane.stops[k]!.x).toBeGreaterThanOrEqual(lane.stops[k - 1]!.x);
      }
    }
  });

  it("the order changes on the way — 'có chú vịt lên trước có chú vịt rớt lại phía sau'", () => {
    let winnerLedAtHalfway = 0;
    for (let r = 0; r < 200; r++) {
      const race = duckRace({ ids, random: seeded(r) })!;
      const order = (t: number) => [...race.lanes].sort((a, b) => laneAt(b, t) - laneAt(a, t)).map((l) => l.id);
      // Somebody overtakes somebody in every race.
      expect(order(0.5)).not.toEqual(order(1));
      if (order(0.5)[0] === race.winner) winnerLedAtHalfway++;
    }
    // And the winner often comes from behind: the race is not decided at the halfway mark.
    expect(winnerLedAtHalfway).toBeLessThan(200 * 0.5);
  });

  it("gives a different winner over many races — it is a race, not a rota", () => {
    const winners = new Set(Array.from({ length: 60 }, (_, r) => duckRace({ ids, random: seeded(r + 1000) })!.winner));
    expect(winners.size).toBeGreaterThan(10);
  });

  it("two ducks are enough, and one is not a race", () => {
    expect(duckRace({ ids: [7, 9], random: seeded(3) })).not.toBeNull();
    expect(duckRace({ ids: [7], random: seeded(3) })).toBeNull();
  });
});
