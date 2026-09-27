"use client";

import { useEffect, useRef, useState } from "react";
import { POINT_STEPS, levelFor, levelInfo, type PointEvent, type PointsResult, type Reason, type StudentRow } from "@lhhp/shared";
import { Plant } from "@/components/plant";
import { Avatar, Confetti, Sheet, toast } from "@/components/ui";
import { api, patch, post } from "@/lib/api";
import { firstName, signed } from "@/lib/format";
import { play } from "@/lib/sound";
import { cn, groupClass } from "@/lib/utils";

export interface Burst {
  id: number;
  delta: number;
}

/** One student's sticker: avatar, name, level, drops, and the −💧 / +💧 buttons right on it. */
export function StickerCard({
  s,
  bursts,
  selectMode,
  selected,
  onToggle,
  onScore,
  onMenu,
}: {
  s: StudentRow;
  bursts: Burst[];
  selectMode: boolean;
  selected: boolean;
  onToggle(): void;
  onScore(delta: number): void;
  onMenu(): void;
}) {
  const level = levelFor(s.drops);
  const hit = bursts.length > 0;
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  // Press and hold +💧 for the quick menu (+2, +3, +5…), as a teacher would on a tablet.
  const startHold = () => {
    held.current = false;
    hold.current = setTimeout(() => {
      held.current = true;
      onMenu();
    }, 480);
  };
  const endHold = () => {
    if (hold.current) clearTimeout(hold.current);
  };

  const body = (
    <>
      <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={62} className="mx-auto ring-4 ring-white" />
      <p className="mt-2 line-clamp-2 min-h-[2.6em] text-[0.98rem] font-bold leading-tight" title={s.fullName}>
        {s.fullName}
      </p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-[0.8rem] font-semibold text-ink-soft">
        <span className="flex items-center gap-1" title={level.name}>
          <Plant level={level.level} size={26} /> Lv {level.level}
        </span>
        {s.group ? <span className="rounded-full bg-page px-1.5">T{s.group}</span> : null}
      </p>
    </>
  );

  return (
    <li className={cn("sticker relative flex flex-col px-2 pb-3 pt-3 text-center", groupClass(s.group), hit && "sticker-hit")} data-selected={selected}>
      {selectMode ? (
        <button type="button" className="block w-full rounded-2xl" aria-pressed={selected} onClick={onToggle}>
          {body}
          <span className="point-count mt-1 justify-center">💧 {s.points}</span>
          {selected ? (
            <span aria-hidden className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-pink-ink text-sm text-white">
              ✓
            </span>
          ) : null}
        </button>
      ) : (
        <>
          {body}
          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#f3b3bc] bg-white text-[0.95rem] font-bold text-red-pen active:scale-95"
              aria-label={`Trừ 1 giọt nước của ${s.fullName}`}
              onClick={() => onScore(-1)}
            >
              −💧
            </button>
            <button
              type="button"
              className="point-count min-w-[3rem] justify-center rounded-full px-1.5 py-1 text-[1.05rem] hover:bg-gold-soft"
              aria-label={`${s.fullName} có ${s.points} giọt nước. Mở bảng cộng nhanh`}
              onClick={onMenu}
            >
              {s.points}
            </button>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full bg-gold text-[0.95rem] font-bold shadow-[0_3px_0_#d9ad16] active:translate-y-px"
              aria-label={`Cộng 1 giọt nước cho ${s.fullName}`}
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (held.current) return;
                onScore(1);
              }}
            >
              +💧
            </button>
          </div>
        </>
      )}
      {bursts.map((b) => (
        <span key={b.id} aria-hidden>
          <span className={cn("burst", b.delta > 0 ? "burst-plus" : "burst-minus", b.delta >= 5 && "burst-big")}>
            {signed(b.delta)} 💧
          </span>
          {b.delta > 0 ? (
            <>
              <span className="sparkle left-3 top-6 text-xl">✨</span>
              <span className="sparkle right-3 top-10 text-lg" style={{ animationDelay: "90ms" }}>
                ✨
              </span>
            </>
          ) : null}
        </span>
      ))}
    </li>
  );
}

/**
 * The same child as a row, which is how she asked to see the class: "hiển thị thi đua của học sinh theo danh sách
 * dọc, hiển thị ngang các thông tin" (brief 3, item 8) — ảnh, tên, Lv với hình cây, tổ, rồi giọt nước.
 */
export function StudentListRow({
  s,
  bursts,
  selectMode,
  selected,
  onToggle,
  onScore,
  onMenu,
}: {
  s: StudentRow;
  bursts: Burst[];
  selectMode: boolean;
  selected: boolean;
  onToggle(): void;
  onScore(delta: number): void;
  onMenu(): void;
}) {
  const level = levelFor(s.drops);
  const hit = bursts.length > 0;
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const startHold = () => {
    held.current = false;
    hold.current = setTimeout(() => {
      held.current = true;
      onMenu();
    }, 480);
  };
  const endHold = () => {
    if (hold.current) clearTimeout(hold.current);
  };

  const facts = (
    <>
      <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={44} className="shrink-0 ring-2 ring-white" />
      <span className="min-w-0 flex-1 basis-[7rem] truncate text-left text-[1.02rem] font-bold" title={s.fullName}>
        {s.fullName}
      </span>
      {/* "Mong muốn icon cây to hơn, rõ hơn" (brief 4): the plant is drawn, and it is the biggest thing in the row after the face. */}
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[0.86rem] font-semibold text-ink-soft" title={level.name}>
        <Plant level={level.level} size={40} /> Lv {level.level}
      </span>
      <span className="shrink-0 whitespace-nowrap rounded-full bg-page px-2 py-0.5 text-[0.86rem] font-semibold text-ink-soft">
        {s.group ? `Tổ ${s.group}` : "Chưa có tổ"}
      </span>
    </>
  );

  return (
    <li
      className={cn("sticker relative flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-2.5 py-2", groupClass(s.group), hit && "sticker-hit")}
      data-selected={selected}
    >
      {selectMode ? (
        <button type="button" className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1.5" aria-pressed={selected} onClick={onToggle}>
          {facts}
          <span className="point-count shrink-0">💧 {s.points}</span>
          <span
            aria-hidden
            className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold", selected ? "border-pink-ink bg-pink-ink text-white" : "border-line")}
          >
            {selected ? "✓" : ""}
          </span>
        </button>
      ) : (
        <>
          {facts}
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#f3b3bc] bg-white text-[0.9rem] font-bold text-red-pen active:scale-95"
              aria-label={`Trừ 1 giọt nước của ${s.fullName}`}
              onClick={() => onScore(-1)}
            >
              −💧
            </button>
            <button
              type="button"
              className="point-count min-w-[3rem] justify-center rounded-full px-1.5 py-1 text-[1.05rem] hover:bg-gold-soft"
              aria-label={`${s.fullName} có ${s.points} giọt nước. Mở bảng cộng nhanh`}
              onClick={onMenu}
            >
              {s.points}
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-gold text-[0.9rem] font-bold shadow-[0_3px_0_#d9ad16] active:translate-y-px"
              aria-label={`Cộng 1 giọt nước cho ${s.fullName}`}
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (held.current) return;
                onScore(1);
              }}
            >
              +💧
            </button>
          </span>
        </>
      )}
      {bursts.map((b) => (
        <span key={b.id} aria-hidden>
          <span className={cn("burst", b.delta > 0 ? "burst-plus" : "burst-minus", b.delta >= 5 && "burst-big")}>{signed(b.delta)} 💧</span>
        </span>
      ))}
    </li>
  );
}

/**
 * The quick menu, as it always looked: criteria on top, amounts below. Brief 7 links the criteria to "Điểm cộng" and
 * "Điểm trừ": each one shows its drops, and tapping it gives exactly that at once. The amounts are still there for a
 * quick point without a criterion.
 */
export function QuickScoreSheet({
  open,
  students,
  reasons,
  onClose,
  onScore,
}: {
  open: boolean;
  students: StudentRow[];
  reasons: Reason[];
  onClose(): void;
  onScore(delta: number, reasonId?: number): void;
}) {
  const title =
    students.length === 1 ? `Chấm điểm cho ${firstName(students[0]!.fullName)}` : `Chấm điểm cho ${students.length} bạn`;
  const give = (d: number, reason?: Reason) => {
    onScore(d, reason?.id);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-5">
        <div>
          <p className="mb-2 font-semibold">Theo tiêu chí — bấm là chấm ngay</p>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r.id}
                type="button"
                className={cn("chip", r.kind === "minus" && "text-red-pen")}
                onClick={() => give(r.kind === "plus" ? r.drops : -r.drops, r)}
              >
                <span aria-hidden>{r.emoji}</span> {r.label}{" "}
                <strong className="whitespace-nowrap">
                  {r.kind === "plus" ? "+" : "−"}
                  {r.drops} 💧
                </strong>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold">Cộng điểm</p>
          <div className="grid grid-cols-5 gap-2">
            {POINT_STEPS.map((n) => (
              <button
                key={n}
                type="button"
                className="btn btn-gold !min-h-[56px] !px-0 text-lg"
                onClick={() => give(n)}
              >
                +{n} 💧
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold">Trừ điểm</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 5].map((n) => (
              <button key={n} type="button" className="btn btn-danger !min-h-[52px] !px-0" onClick={() => give(-n)}>
                −{n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-soft">Trừ điểm để nhắc nhở nhẹ nhàng. Cây của con không bao giờ nhỏ lại.</p>
        </div>
      </div>
    </Sheet>
  );
}

/** After each award: undo it, or name its reason. */
export function UndoBar({
  last,
  reasons,
  classId,
  raised,
  onUndone,
  onReasoned,
  onDismiss,
}: {
  last: { result: PointsResult; label: string } | null;
  reasons: Reason[];
  classId: number;
  /** Sit above the "Đã chọn N bạn" bar instead of on top of it. */
  raised?: boolean;
  onUndone(result: PointsResult): void;
  onReasoned(events: PointEvent[]): void;
  onDismiss(): void;
}) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!last || picking) return;
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [last, picking, onDismiss]);
  if (!last) return null;
  const delta = last.result.events[0]?.delta ?? 0;
  const fitting = reasons.filter((r) => (r.kind === "plus") === delta > 0);
  return (
    <>
      <div className={cn("no-print fixed inset-x-0 z-50 flex justify-center px-3", raised ? "bottom-20" : "bottom-4")}>
        <div className="pop-in flex max-w-full flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-white shadow-xl">
          <span className="font-semibold">{last.label}</span>
          <button type="button" className="btn btn-sm !min-h-[34px] bg-white/15 text-white hover:bg-white/25" onClick={() => setPicking(true)}>
            Thêm lý do
          </button>
          <button
            type="button"
            className="btn btn-sm !min-h-[34px] bg-white text-ink"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await api<{ removed: number }>(`/api/t/classes/${classId}/points/batch/${last.result.batchId}`, { method: "DELETE" });
              setBusy(false);
              if (!r.ok) return toast(r.message, "error");
              // Nothing removed means it was already undone (a double tap, or from the history): change nothing on screen.
              if (r.data.removed === 0) {
                onDismiss();
                return toast("Lượt chấm này đã được hoàn tác rồi.");
              }
              onUndone(last.result);
              toast("Đã hoàn tác.");
            }}
          >
            Hoàn tác
          </button>
        </div>
      </div>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Chọn lý do">
        <div className="flex flex-wrap gap-2">
          {fitting.map((r) => (
            <button
              key={r.id}
              type="button"
              className="chip"
              onClick={async () => {
                const results = await Promise.all(last.result.events.map((e) => patch<PointEvent>(`/api/t/points/${e.id}`, { reasonId: r.id })));
                const failed = results.find((x) => !x.ok);
                if (failed && !failed.ok) return toast(failed.message, "error");
                onReasoned(results.flatMap((x) => (x.ok ? [x.data] : [])));
                setPicking(false);
                onDismiss();
                toast(`Đã ghi lý do: ${r.label}.`);
              }}
            >
              <span aria-hidden>{r.emoji}</span> {r.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export function LevelUpDialog({ item, onClose }: { item: { fullName: string; level: number; url: string | null; emoji: string } | null; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item && !d.open) {
      d.showModal();
      play("levelup");
    }
    if (!item && d.open) d.close();
  }, [item]);
  // Past "Quả chín" there is no entry in LEVELS: levelInfo names those levels too.
  const info = item ? levelInfo(item.level) : null;
  return (
    <dialog
      ref={ref}
      className="sheet !w-[min(460px,calc(100vw-24px))] overflow-visible"
      onCancel={(e) => {
        // Escape closes this celebration only; the next one in the queue still shows.
        e.preventDefault();
        onClose();
      }}
    >
      {item && info ? (
        <div className="pop-in px-6 pb-7 pt-8 text-center">
          <Confetti />
          <p className="font-display text-[2.4rem] font-extrabold text-pink-ink">🎉 Chúc mừng!</p>
          <Avatar emoji={item.emoji} url={item.url} name={item.fullName} size={96} className="mx-auto mt-3 ring-8 ring-gold-soft" />
          <p className="mt-4 font-display text-[1.7rem] font-extrabold leading-tight">
            Cây của {firstName(item.fullName)} vừa lớn lên!
          </p>
          <Plant level={info.level} size={132} className="mx-auto mt-2" />
          <p className="mt-1 text-lg text-ink-soft">
            Lv {info.level} · {info.name}
          </p>
          <button type="button" className="btn btn-primary mt-6 text-lg" onClick={onClose} autoFocus>
            ❤️ Tuyệt vời!
          </button>
        </div>
      ) : null}
    </dialog>
  );
}

/** Sends an award, and returns what the screen needs to celebrate or roll back. */
export async function sendPoints(classId: number, studentIds: number[], delta: number, reasonId?: number) {
  play(delta > 0 ? "plus" : "minus");
  return post<PointsResult>(`/api/t/classes/${classId}/points`, { studentIds, delta, ...(reasonId ? { reasonId } : {}) });
}
