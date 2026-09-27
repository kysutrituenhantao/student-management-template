/**
 * How the "gọi tên ngẫu nhiên" games move. She wrote the movement down herself, and rewrote it in brief 14 (26/09):
 *
 *   "Vòng quay may mắn: tạo hiệu ứng quay 3-4 vòng rồi chậm dần ở tên bạn được chọn"
 *   "Chiếc mũ bí mật: … một chiếc mũ ảo thuật đặt ngửa, có 1 bàn tay gõ vào chiếc mũ khoảng 3-5s sau tên hiện lên"
 *   "Đua vịt: cả lớp cùng đua… cuộc đua khoảng 5s, có chú vịt lên trước có chú vịt rớt lại phía sau, tạo sự hồi hộp"
 *
 * They are numbers, so they live here with their tests rather than scattered through the components: the pieces
 * that decide *how long*, *where it stops* and *who is ahead when* are pure, and the components only draw the answer.
 */

/** A spin turns at least three times and less than four, alignment included. */
export const WHEEL_TURNS_MIN = 3;
export const WHEEL_TURNS_MAX = 4;
/** Milliseconds per turn: long enough that the slow finish is a real slow finish, "chậm dần ở tên bạn được chọn". */
export const WHEEL_MS_PER_TURN = 1700;
/** Fast off the mark, then a long, slow creep onto the name. */
export const WHEEL_EASING = "cubic-bezier(0.08, 0.72, 0.06, 1)";

/** "Có 1 bàn tay gõ vào chiếc mũ khoảng 3-5s sau tên hiện lên." */
export const HAT_TAP_MIN_MS = 3000;
export const HAT_TAP_MAX_MS = 5000;

/** "Cuộc đua khoảng 5s." */
export const DUCK_RACE_MIN_MS = 4700;
export const DUCK_RACE_MAX_MS = 5300;
/** Where the others are when the winner is home: close enough that it looked like anyone's race. */
const DUCK_RUNNER_UP_MIN = 0.8;
const DUCK_RUNNER_UP_MAX = 0.97;
/** The race is planned in stages; in each one a duck swims at a pace of its own, so the order keeps changing. */
const DUCK_STAGES = 6;

export interface WheelSpin {
  /** Who it stops on: an index into the names, in the order they are drawn. */
  index: number;
  /** Total rotation in turns, 3 ≤ turns < 4. */
  turns: number;
  /** The absolute angle to rotate the wheel to, in degrees, always greater than where it was. */
  angle: number;
  durationMs: number;
}

/**
 * Where the wheel stops. The pointer is at the top and slice `i` is drawn from the top clockwise, so the winner's
 * slice ends under the pointer when the total rotation is a whole number of turns plus that slice's offset. The
 * offset is what makes one spin longer than another — between three and four turns, as she asked.
 */
export function wheelSpin({ count, from, random = Math.random }: { count: number; from: number; random?: () => number }): WheelSpin | null {
  if (count < 1) return null;
  const index = Math.min(count - 1, Math.floor(random() * count));
  const slice = 360 / count;
  // Clockwise from the top to the middle of the winning slice; turning that much more brings it back under the pointer.
  const offset = (((-(index * slice + slice / 2)) % 360) + 360) % 360;
  const spun = WHEEL_TURNS_MIN * 360 + offset;
  return {
    index,
    turns: spun / 360,
    angle: from + spun,
    durationMs: Math.round((spun / 360) * WHEEL_MS_PER_TURN),
  };
}

/** How long the hand taps the hat before the name comes out. */
export function hatTapMs(random: () => number = Math.random): number {
  return Math.round(HAT_TAP_MIN_MS + Math.min(1, Math.max(0, random())) * (HAT_TAP_MAX_MS - HAT_TAP_MIN_MS));
}

export interface DuckLane {
  id: number;
  /**
   * The duck's course: at time `at` (0 → 1 of the race) it has swum `x` (0 → 1 of the lane). Starts at {0, 0}; the
   * winner's ends at {1, 1}, everyone else's short of the line.
   */
  stops: { at: number; x: number }[];
}

export interface DuckRace {
  winner: number;
  durationMs: number;
  lanes: DuckLane[];
}

/** How far a duck has swum at time `t` (0 → 1), between its stops. */
export function laneAt(lane: DuckLane, t: number): number {
  const s = lane.stops;
  if (t <= s[0]!.at) return s[0]!.x;
  for (let k = 1; k < s.length; k++) {
    if (t <= s[k]!.at) {
      const a = s[k - 1]!;
      const b = s[k]!;
      return a.x + ((t - a.at) / (b.at - a.at)) * (b.x - a.x);
    }
  }
  return s[s.length - 1]!.x;
}

/**
 * The whole class races, for about five seconds. Each duck's pace changes from stage to stage, so ducks overtake and
 * fall back; half the time the winner is held back early and comes through at the end — "tạo sự hồi hộp".
 */
export function duckRace({ ids, random = Math.random }: { ids: number[]; random?: () => number }): DuckRace | null {
  if (ids.length < 2) return null;
  const durationMs = Math.round(DUCK_RACE_MIN_MS + random() * (DUCK_RACE_MAX_MS - DUCK_RACE_MIN_MS));
  const winner = ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))]!;
  const comeback = random() < 0.5;
  const lanes = ids.map((id) => {
    const isWinner = id === winner;
    const paces = Array.from({ length: DUCK_STAGES }, (_, k) => {
      const pace = 0.35 + random() * 1.1;
      if (!isWinner || !comeback) return pace;
      // Slow out of the blocks, then the charge.
      return k < DUCK_STAGES / 2 ? pace * 0.45 : pace * 1.6;
    });
    const total = paces.reduce((a, b) => a + b, 0);
    const end = isWinner ? 1 : DUCK_RUNNER_UP_MIN + random() * (DUCK_RUNNER_UP_MAX - DUCK_RUNNER_UP_MIN);
    let swum = 0;
    const stops = [{ at: 0, x: 0 }];
    paces.forEach((p, k) => {
      swum += p;
      stops.push({ at: (k + 1) / DUCK_STAGES, x: k === DUCK_STAGES - 1 ? end : (swum / total) * end });
    });
    return { id, stops };
  });
  return { winner, durationMs, lanes };
}
