"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WHEEL_EASING, duckRace, hatTapMs, wheelSpin, type DuckRace as DuckRacePlan, type StudentRow } from "@lhhp/shared";
import { Avatar, Confetti } from "@/components/ui";
import { firstName } from "@/lib/format";
import { play } from "@/lib/sound";
import { cn } from "@/lib/utils";

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "Gọi ngẫu nhiên": names flicker, then one child is called. Each child is called once before anyone twice. */
export function RandomPicker({ students, onDrop }: { students: StudentRow[]; onDrop?(s: StudentRow): void }) {
  const [current, setCurrent] = useState<StudentRow | null>(null);
  const [rolling, setRolling] = useState(false);
  const pool = useRef<StudentRow[]>([]);

  function roll() {
    if (students.length === 0) return;
    if (pool.current.length === 0) pool.current = shuffle(students);
    const pick = pool.current.pop()!;
    if (reduceMotion()) {
      setCurrent(pick);
      return;
    }
    setRolling(true);
    let n = 0;
    const timer = setInterval(() => {
      setCurrent(students[Math.floor(Math.random() * students.length)]!);
      play("tick");
      if (++n >= 14) {
        clearInterval(timer);
        setCurrent(pick);
        setRolling(false);
        play("win");
      }
    }, 80);
  }

  return (
    <div className="grid place-items-center gap-4 py-2 text-center">
      <div className={cn("sticker grid min-h-[210px] w-full max-w-sm place-items-center p-6", current ? `group-${current.group ?? 0}` : "group-0")}>
        {current ? (
          <div className={cn(!rolling && "pop-in")}>
            <Avatar emoji={current.avatarEmoji} url={current.avatarUrl} name={current.fullName} size={96} className="mx-auto" />
            <p className="mt-3 font-display text-[2rem] font-extrabold leading-tight">{current.fullName}</p>
          </div>
        ) : (
          <p className="text-ink-soft">Bấm nút để gọi một bạn bất kỳ.</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary text-lg" onClick={roll} disabled={rolling || students.length === 0}>
          🎲 {current ? "Gọi bạn khác" : "Gọi ngẫu nhiên"}
        </button>
        {current && !rolling && onDrop ? (
          <button type="button" className="btn btn-gold" onClick={() => onDrop(current)}>
            +1 💧 cho {firstName(current.fullName)}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** "Chia nhóm": split the class into N random groups for an activity. Doesn't touch the class's tổ. */
export function GroupSplit({ students }: { students: StudentRow[] }) {
  const [count, setCount] = useState(4);
  const [groups, setGroups] = useState<StudentRow[][]>([]);
  const split = () => {
    const out: StudentRow[][] = Array.from({ length: count }, () => []);
    shuffle(students).forEach((s, i) => out[i % count]!.push(s));
    setGroups(out);
    play("win");
  };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Số nhóm:</span>
        {[2, 3, 4, 5, 6, 8].map((n) => (
          <button key={n} type="button" className="chip" aria-pressed={count === n} onClick={() => setCount(n)}>
            {n}
          </button>
        ))}
        <button type="button" className="btn btn-primary ml-auto" onClick={split} disabled={students.length === 0}>
          👥 {groups.length ? "Chia lại" : "Chia nhóm"}
        </button>
      </div>
      {groups.length ? (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g, i) => (
            <li key={i} className={cn("sticker p-4", `group-${(i % 8) + 1}`)}>
              <p className="font-display text-xl font-extrabold">Nhóm {i + 1}</p>
              <ul className="mt-2 grid gap-1.5">
                {g.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={30} />
                    <span className="font-medium">{s.fullName}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/**
 * The chosen child, in a window of its own in the middle of the screen (brief 16: "hiển thị tên đc chọn thành 1 cửa sổ
 * mới giữa màn hình. Hiển thị ngay sau khi hết hiệu ứng chọn tên"). The wheel, the hat and the duck race all open it
 * the moment their effect ends.
 */
function ChosenWindow({
  student,
  heading,
  picture,
  onDrop,
  onClose,
  extra,
}: {
  student: StudentRow;
  heading: string;
  /** What to show above the name: the child's photo, or the winning duck. */
  picture?: ReactNode;
  onDrop?(s: StudentRow): void;
  onClose(): void;
  /** One more thing the game can offer, e.g. "Bỏ ra và quay tiếp". */
  extra?: ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Bạn được chọn"
      className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(59,42,74,0.45)] p-4"
      onKeyDown={(e) => {
        // Escape closes this window only, not the game behind it.
        if (e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }
      }}
    >
      {/* Out of the centring grid, or it would take a row of its own and push the window down. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Confetti pieces={60} />
      </div>
      <div data-window className="pop-in relative grid w-[min(560px,92vw)] justify-items-center gap-2 rounded-[28px] bg-white px-6 pb-6 pt-5 text-center shadow-[0_24px_70px_rgba(59,42,74,0.4)]">
        <button
          type="button"
          aria-label="Đóng cửa sổ"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-xl text-ink-soft hover:bg-pink-soft"
        >
          ✕
        </button>
        <p className="font-display text-lg font-bold text-ink-soft">🎉 Bạn được chọn</p>
        {picture ?? <Avatar emoji={student.avatarEmoji} url={student.avatarUrl} name={student.fullName} size={110} />}
        <p className="red-pen text-2xl">{heading}</p>
        <p data-testid="winner-name" className="font-display text-[2.6rem] font-extrabold leading-tight text-pink-ink sm:text-[3.8rem]">
          {student.fullName}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onDrop ? (
            <button
              type="button"
              className="btn btn-gold text-lg"
              onClick={() => {
                onDrop(student);
                onClose();
              }}
            >
              +1 💧 cho {firstName(student.fullName)}
            </button>
          ) : null}
          {extra}
          <button ref={close} type="button" className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

const WHEEL_COLORS = ["#ffb3ce", "#a9dbf5", "#ffe27a", "#a8e6c3", "#d4c1f5", "#ffc9a3", "#9ee7e3", "#d6ef9a"];

/**
 * "Vòng quay may mắn": "tạo hiệu ứng quay 3-4 vòng rồi chậm dần ở tên bạn được chọn" (brief 14). How far and how long
 * it turns is `wheelSpin`; the easing is fast off the mark and then a long, slow creep onto the name.
 */
export function LuckyWheel({ students, onDrop }: { students: StudentRow[]; onDrop?(s: StudentRow): void }) {
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [angle, setAngle] = useState(0);
  const [spinMs, setSpinMs] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<StudentRow | null>(null);
  const [removeWinner, setRemoveWinner] = useState(true);
  const names = useMemo(() => students.filter((s) => !removed.has(s.id)), [students, removed]);
  const n = names.length;
  const slice = 360 / Math.max(n, 1);
  const r = 190;

  function spin() {
    if (n < 2 || spinning) return;
    const plan = wheelSpin({ count: n, from: angle });
    if (!plan) return;
    setWinner(null);
    if (reduceMotion()) {
      setAngle(plan.angle);
      setWinner(names[plan.index]!);
      play("win");
      return;
    }
    setSpinning(true);
    setSpinMs(plan.durationMs);
    setAngle(plan.angle);
    setTimeout(() => {
      setSpinning(false);
      setWinner(names[plan.index]!);
      play("win");
    }, plan.durationMs);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_1fr]">
      <div className="relative mx-auto w-[min(420px,86vw)]">
        <div aria-hidden className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 text-4xl drop-shadow">
          🔻
        </div>
        <svg
          viewBox="-200 -200 400 400"
          className="w-full drop-shadow-[0_6px_0_#f7b6cd]"
          style={{ transform: `rotate(${angle}deg)`, transition: spinning ? `transform ${spinMs}ms ${WHEEL_EASING}` : "none" }}
          role="img"
          aria-label={`Vòng quay với ${n} bạn`}
        >
          <circle r="198" fill="#fff" />
          {names.map((s, i) => {
            const a0 = ((i * slice - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * slice - 90) * Math.PI) / 180;
            const large = slice > 180 ? 1 : 0;
            const mid = (i + 0.5) * slice - 90;
            // Names on the left half would read upside down: turn them around.
            const flip = mid > 90 && mid < 270;
            return (
              <g key={s.id}>
                <path
                  d={n === 1 ? `M0,-${r} A${r},${r} 0 1,1 -0.1,-${r} Z` : `M0,0 L${r * Math.cos(a0)},${r * Math.sin(a0)} A${r},${r} 0 ${large},1 ${r * Math.cos(a1)},${r * Math.sin(a1)} Z`}
                  fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <text
                  transform={flip ? `rotate(${mid}) translate(${r - 14},0) rotate(180)` : `rotate(${mid}) translate(${r - 14},0)`}
                  textAnchor={flip ? "start" : "end"}
                  dominantBaseline="middle"
                  fontSize={n > 30 ? 11 : n > 20 ? 13 : 16}
                  fontWeight="700"
                  fill="#3b2a4a"
                  style={{ fontFamily: "var(--font-bevn)" }}
                >
                  {firstName(s.fullName)}
                </text>
              </g>
            );
          })}
          <circle r="26" fill="#fff" stroke="#ffb3ce" strokeWidth="6" />
        </svg>
      </div>
      <div className="grid gap-4">
        <button type="button" className="btn btn-primary text-lg" onClick={spin} disabled={spinning || n < 2}>
          🎡 {spinning ? "Đang quay…" : "Quay!"}
        </button>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--pink-ink)]" checked={removeWinner} onChange={(e) => setRemoveWinner(e.target.checked)} />
          Bỏ bạn đã trúng ra khỏi vòng quay
        </label>
        {winner ? (
          <ChosenWindow
            student={winner}
            heading="Bạn may mắn là…"
            onDrop={onDrop}
            onClose={() => setWinner(null)}
            extra={
              removeWinner ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setRemoved((r0) => new Set(r0).add(winner.id));
                    setWinner(null);
                  }}
                >
                  Bỏ ra và quay tiếp
                </button>
              ) : null
            }
          />
        ) : null}
        {removed.size ? (
          <button type="button" className="btn btn-ghost btn-sm justify-self-start" onClick={() => setRemoved(new Set())}>
            Đưa {removed.size} bạn trở lại vòng quay
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Twelve ducks' worth of colours, so a class of thirty-five has few twins and neighbours never match. */
const DUCK_COLORS = [
  "#ffd23f", "#ff8c42", "#ff6b9a", "#e84855", "#9b5de5", "#4d96ff",
  "#2ec4b6", "#3bb273", "#b5e048", "#a0785a", "#f7f3e3", "#7bdff2",
];

/** A duck, drawn rather than an emoji, so a colour is really a colour. It faces right, towards the finish. */
function Duck({ color, size }: { color: string; size: number }) {
  return (
    <svg viewBox="0 0 64 48" width={size} height={(size * 48) / 64} aria-hidden className="shrink-0 overflow-visible">
      <ellipse cx="30" cy="42" rx="24" ry="4" fill="#5aa9d6" opacity="0.5" />
      <path d="M8,28 Q4,18 12,20 Q16,14 22,22 L40,22 Q52,22 50,34 Q46,44 28,44 Q10,44 8,28 Z" fill={color} stroke="#3b2a4a" strokeWidth="2" />
      <path d="M20,30 Q30,24 38,32 Q30,38 22,34 Z" fill="#000" opacity="0.12" />
      <circle cx="46" cy="16" r="10" fill={color} stroke="#3b2a4a" strokeWidth="2" />
      <path d="M54,15 L63,18 L54,21 Z" fill="#ff9f1c" stroke="#3b2a4a" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="48" cy="13" r="2.2" fill="#3b2a4a" />
      <circle cx="48.8" cy="12.3" r="0.7" fill="#fff" />
    </svg>
  );
}

/** How many ducks deep the pond is: "hiển thị động rộng khoảng 5 làn (nhưng k chia làn)" (brief 16). */
const POND_ROWS = 5;

/**
 * "Đua vịt: cả lớp cùng đua, tạo hiệu ứng có tên HS trên mỗi con vịt màu sắc của vịt đa dạng khác nhau… cuộc đua
 * khoảng 5s, có chú vịt lên trước có chú vịt rớt lại phía sau" (brief 14), in "one pond about five lanes wide with no
 * lanes, the ducks crowding side by side" (brief 16).
 *
 * `duckRace` plans every duck's course in stages before the first one moves; each duck then runs as one Web Animation
 * through those stages, so the browser moves thirty-five ducks smoothly and the order changes on the way. Each duck
 * swims at its own depth in the pond — five rows' worth, jittered, so they jostle rather than queue.
 */
export function DuckRace({ students, onDrop }: { students: StudentRow[]; onDrop?(s: StudentRow): void }) {
  const [race, setRace] = useState<DuckRacePlan | null>(null);
  const [running, setRunning] = useState(false);
  const [winner, setWinner] = useState<StudentRow | null>(null);
  const sliders = useRef(new Map<number, HTMLElement>());
  const anims = useRef<Animation[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      anims.current.forEach((a) => a.cancel());
    },
    [],
  );

  const racers = students;
  const colorOf = (i: number) => DUCK_COLORS[i % DUCK_COLORS.length]!;
  // Where each duck swims, top to bottom, and how far back from the line it starts: a crowd, not a grid.
  const spots = useMemo(
    () =>
      racers.map((_, i) => ({
        row: i % POND_ROWS,
        jitter: ((i * 37) % 11) - 5,
        start: ((i * 53) % 9) * 0.004,
      })),
    [racers],
  );

  useLayoutEffect(() => {
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
    if (!race || !running) return;
    for (const [i, s] of racers.entries()) {
      const lane = race.lanes.find((l) => l.id === s.id);
      const el = sliders.current.get(s.id);
      if (!lane || !el) continue;
      const start = spots[i]!.start;
      const frames = lane.stops.map((st) => ({
        offset: st.at,
        transform: `translateX(calc(${start + st.x * (1 - start)} * (100% - var(--duck-run))))`,
        easing: "ease-in-out",
      }));
      anims.current.push(el.animate(frames, { duration: race.durationMs, fill: "forwards" }));
    }
  }, [race, running, racers, spots]);

  function start() {
    const plan = duckRace({ ids: racers.map((s) => s.id) });
    if (!plan || running) return;
    setWinner(null);
    setRace(plan);
    const won = racers.find((s) => s.id === plan.winner) ?? null;
    if (reduceMotion()) {
      setWinner(won);
      play("win");
      return;
    }
    setRunning(true);
    timer.current = setTimeout(() => {
      setRunning(false);
      setWinner(won);
      play("win");
    }, plan.durationMs);
  }

  // Before a race the ducks crowd the start; after one they stay where they finished until the next.
  const restingAt = (i: number, id: number) => {
    const start = spots[i]!.start;
    const lane = race?.lanes.find((l) => l.id === id);
    const x = !running && lane ? lane.stops[lane.stops.length - 1]!.x : 0;
    return start + x * (1 - start);
  };
  const winnerIndex = winner ? racers.findIndex((s) => s.id === winner.id) : -1;
  const ROW = 44;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto font-semibold">🦆 Cả lớp cùng đua — {racers.length} bạn</p>
        <button type="button" className="btn btn-primary text-lg" disabled={running || racers.length < 2} onClick={start}>
          🦆 {running ? "Đang đua…" : race ? "Đua lại" : "Bắt đầu đua"}
        </button>
      </div>
      {racers.length < 2 ? (
        <p className="py-6 text-center text-ink-soft">Cần ít nhất 2 bạn để đua.</p>
      ) : (
        <div
          role="img"
          aria-label={`Hồ đua vịt với ${racers.length} bạn`}
          className="relative overflow-hidden rounded-[28px] border-4 border-white bg-[radial-gradient(ellipse_at_30%_20%,#d4efff,#8fcbed_70%)] shadow-[0_0_0_2px_#93cdee]"
          style={{ height: POND_ROWS * ROW + 46, ["--duck-run" as string]: "5.2em" }}
        >
          {/* Ripples on the water, and the finish flag. No lanes: one pond. */}
          <div aria-hidden className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_70%_60%,transparent_0_18px,rgba(255,255,255,0.18)_19px_21px)]" />
          <div aria-hidden className="absolute inset-y-0 right-3 w-3 bg-[repeating-linear-gradient(0deg,#fff_0_8px,#3b2a4a_8px_16px)] opacity-90" />
          <span aria-hidden className="absolute right-0 top-0 text-2xl">
            🏁
          </span>
          <div className="absolute inset-y-0 left-2 right-6">
            {racers.map((s, i) => {
              const spot = spots[i]!;
              return (
                <span
                  key={s.id}
                  ref={(el) => {
                    if (el) sliders.current.set(s.id, el);
                    else sliders.current.delete(s.id);
                  }}
                  data-duck
                  data-colour={colorOf(i)}
                  className="absolute left-0 flex w-full"
                  style={{
                    top: 14 + spot.row * ROW + spot.jitter,
                    // Nearer the bottom of the pond is nearer the class: those ducks swim in front.
                    zIndex: 10 + spot.row * 10 + (i % 7),
                    transform: `translateX(calc(${restingAt(i, s.id)} * (100% - var(--duck-run))))`,
                  }}
                >
                  <span className="flex flex-col items-center" style={{ width: "var(--duck-run)" }}>
                    <span
                      className="max-w-full truncate rounded-full border-2 bg-white/95 px-1.5 text-[0.7rem] font-bold leading-tight shadow-sm"
                      style={{ borderColor: colorOf(i) }}
                    >
                      {firstName(s.fullName)}
                    </span>
                    <span className={cn(running && "duck-bob")} style={{ animationDelay: `${(i % 5) * 90}ms` }}>
                      <Duck color={colorOf(i)} size={40} />
                    </span>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
      {winner ? (
        <ChosenWindow
          student={winner}
          heading="🏆 Về nhất!"
          picture={<Duck color={colorOf(winnerIndex)} size={120} />}
          onDrop={onDrop}
          onClose={() => setWinner(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * A magician's hand in a white glove, holding a wand: it waves over the hat and points into it (brief 16: "bàn tay cầm
 * gậy ảo thuật làm hành động như ảo thuật chỉ vào mũ").
 */
function WandHand({ waving }: { waving: boolean }) {
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden
      data-wand
      data-waving={waving ? "" : undefined}
      className={cn("absolute right-[-4%] top-[40px] z-10 w-[46%] origin-[85%_70%]", waving ? "wand-wave" : "rotate-[8deg]")}
    >
      {/* The wand: black, with a white tip, pointing down and left into the hat. */}
      <g transform="rotate(-32 110 80)">
        <rect x="8" y="74" width="112" height="10" rx="4" fill="#2a1d36" />
        <rect x="8" y="74" width="20" height="10" rx="4" fill="#fff" stroke="#2a1d36" strokeWidth="1.5" />
      </g>
      {/* The glove around it. */}
      <path d="M104,60 Q96,52 104,48 L124,52 Q138,46 146,56 Q152,70 144,84 L126,92 Q110,94 104,84 Q98,76 104,70 Z" fill="#fff" stroke="#3b2a4a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M106,62 Q118,60 124,66 M106,72 Q118,70 126,76" fill="none" stroke="#3b2a4a" strokeWidth="2" strokeLinecap="round" />
      <path d="M140,50 L156,44 L160,62 L146,70 Z" fill="#d92d48" stroke="#3b2a4a" strokeWidth="3" strokeLinejoin="round" />
      {/* Sparkles off the tip while it waves. */}
      {waving ? (
        <g className="wand-spark">
          <text x="2" y="118" fontSize="18">
            ✨
          </text>
          <text x="22" y="104" fontSize="12">
            ⭐
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/**
 * "Chiếc mũ bí mật" (brief 14), with brief 16's magician: a gloved hand waves a wand over an upturned top hat and
 * points into it for 3–5 seconds; then a puff of smoke and stars — "hiệu ứng biến hình" — and the chosen name opens
 * in its window. Every child is called once before anyone twice.
 */
export function MagicHat({ students, onDrop }: { students: StudentRow[]; onDrop?(s: StudentRow): void }) {
  // idle → waving (the wand, 3–5 s) → poof (the transformation) → the window.
  const [phase, setPhase] = useState<"idle" | "waving" | "poof">("idle");
  const [out, setOut] = useState<StudentRow | null>(null);
  const [shown, setShown] = useState(false);
  const pool = useRef<StudentRow[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);
  const POOF_MS = 900;

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (ticks.current) clearInterval(ticks.current);
    },
    [],
  );

  function wave() {
    if (students.length === 0 || phase !== "idle") return;
    if (pool.current.length === 0) pool.current = shuffle(students);
    const pick = pool.current.pop()!;
    setOut(pick);
    setShown(false);
    if (reduceMotion()) {
      setShown(true);
      play("win");
      return;
    }
    setPhase("waving");
    play("tick");
    ticks.current = setInterval(() => play("tick"), 520);
    timers.current = [
      setTimeout(() => {
        if (ticks.current) clearInterval(ticks.current);
        setPhase("poof");
        play("levelup");
      }, hatTapMs()),
    ];
  }

  // The window opens as the smoke clears.
  useEffect(() => {
    if (phase !== "poof") return;
    const t = setTimeout(() => {
      setPhase("idle");
      setShown(true);
      play("win");
    }, POOF_MS);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr]">
      <div className="relative mx-auto h-[330px] w-[min(340px,86vw)]">
        {phase === "waving" ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[70px] z-10 h-24">
            {["left-[30%]", "left-[52%]", "left-[68%]", "left-[42%]"].map((pos, i) => (
              <span key={pos} className={cn("hat-sparkle absolute text-2xl", pos)} style={{ animationDelay: `${i * 220}ms` }}>
                ✨
              </span>
            ))}
          </div>
        ) : null}
        {phase === "poof" && out ? (
          // The transformation: smoke billows out of the hat, stars burst, and the name shimmers into view.
          <div data-poof aria-hidden className="pointer-events-none absolute inset-x-0 top-[40px] z-20 grid h-[170px] place-items-center">
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <span
                key={k}
                className="hat-smoke absolute h-20 w-20 rounded-full bg-white"
                style={{ ["--sx" as string]: `${(k - 2.5) * 34}px`, ["--sy" as string]: `${-20 - (k % 3) * 22}px`, animationDelay: `${k * 50}ms` }}
              />
            ))}
            {["⭐", "✨", "🌟", "✨", "⭐", "💫"].map((e, k) => (
              <span
                key={`s${k}`}
                className="hat-burst absolute text-2xl"
                style={{ ["--bx" as string]: `${Math.cos((k / 6) * Math.PI * 2) * 120}px`, ["--by" as string]: `${Math.sin((k / 6) * Math.PI * 2) * 80 - 30}px` }}
              >
                {e}
              </span>
            ))}
            <span className="hat-reveal relative z-10 rounded-2xl bg-white/90 px-4 py-2 font-display text-2xl font-extrabold text-pink-ink shadow">
              {out.fullName}
            </span>
          </div>
        ) : null}
        <svg
          viewBox="0 0 300 300"
          className={cn("absolute inset-x-0 bottom-0 z-0 w-full", phase === "waving" && "hat-shake")}
          role="img"
          aria-label="Chiếc mũ ảo thuật đặt ngửa"
        >
          <ellipse cx="150" cy="282" rx="96" ry="12" fill="#3b2a4a" opacity="0.15" />
          {/* The crown, at the bottom: the hat stands on its head. */}
          <path d="M84,150 L96,262 Q150,284 204,262 L216,150 Z" fill="#3b2a4a" />
          <path d="M104,158 L112,256 Q124,262 132,264 L126,160 Z" fill="#fff" opacity="0.12" />
          <ellipse cx="150" cy="262" rx="54" ry="12" fill="#2a1d36" />
          {/* The band, just under the brim. */}
          <path d="M86,164 L214,164 L211,194 Q150,206 89,194 Z" fill="#d92d48" />
          {/* The brim and the dark opening, on top. */}
          <ellipse cx="150" cy="150" rx="112" ry="26" fill="#2a1d36" />
          <ellipse cx="150" cy="146" rx="112" ry="24" fill="#4a3660" />
          <ellipse cx="150" cy="146" rx="70" ry="14" fill="#120c18" />
          <text x="150" y="238" textAnchor="middle" fontSize="30" aria-hidden>
            ⭐
          </text>
        </svg>
        <WandHand waving={phase === "waving"} />
      </div>

      <div className="grid gap-4">
        <button type="button" className="btn btn-primary text-lg" onClick={wave} disabled={phase !== "idle" || students.length === 0}>
          🎩 {phase === "waving" ? "Đang làm phép…" : phase === "poof" ? "Biến!" : out ? "Gõ mũ lần nữa" : "Gõ mũ"}
        </button>
        <p className="text-ink-soft">
          {phase === "waving"
            ? "Cây gậy thần đang làm phép… các con đoán xem là bạn nào?"
            : "Bấm “Gõ mũ”: bàn tay cầm gậy thần làm phép vào chiếc mũ, rồi tên một bạn hiện ra. Mỗi bạn được gọi một lần trước khi vòng mới bắt đầu."}
        </p>
      </div>
      {shown && out ? (
        <ChosenWindow student={out} heading="Từ chiếc mũ bí mật… bạn được gọi là" onDrop={onDrop} onClose={() => setShown(false)} />
      ) : null}
    </div>
  );
}

const CALL_WAYS = [
  { id: "quick", label: "Gọi nhanh", emoji: "🎲" },
  { id: "wheel", label: "Vòng quay may mắn", emoji: "🎡" },
  // Brief 14: "Bắn tên đổi thành: Chiếc mũ bí mật".
  { id: "hat", label: "Chiếc mũ bí mật", emoji: "🎩" },
  { id: "duck", label: "Đua vịt", emoji: "🦆" },
] as const;

/**
 * "Phần chọn ngẫu nhiên còn đơn điệu" (brief 3, item 3): the same "call on someone" from the scoring screen, but
 * she picks how — a quick flicker of names, the wheel, the magic hat, or a duck race — and gives the drop from there.
 */
export function CallOnSomeone({ students, onDrop }: { students: StudentRow[]; onDrop?(s: StudentRow): void }) {
  const [way, setWay] = useState<(typeof CALL_WAYS)[number]["id"]>("quick");
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Cách gọi tên" className="flex flex-wrap gap-2">
        {CALL_WAYS.map((w) => (
          <button key={w.id} type="button" role="tab" className="chip !min-h-[44px]" aria-selected={way === w.id} onClick={() => setWay(w.id)}>
            <span aria-hidden>{w.emoji}</span> {w.label}
          </button>
        ))}
      </div>
      {students.length === 0 ? (
        <p className="py-8 text-center text-ink-soft">Lớp chưa có học sinh.</p>
      ) : way === "quick" ? (
        <RandomPicker students={students} onDrop={onDrop} />
      ) : way === "wheel" ? (
        <LuckyWheel students={students} onDrop={onDrop} />
      ) : way === "hat" ? (
        <MagicHat students={students} onDrop={onDrop} />
      ) : (
        <DuckRace students={students} onDrop={onDrop} />
      )}
    </div>
  );
}
