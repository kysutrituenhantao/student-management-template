"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Trash2 } from "lucide-react";
import {
  HONOUR_INFO,
  HONOUR_PERIODS,
  addDays,
  type ClassOverview,
  type Honour,
  type HonourBoard,
  type HonourPeriod,
} from "@lhhp/shared";
import { Avatar, Confetti, Confirm, Empty, Field, FormError, Loading, LoadError, Sheet, TextArea, toast } from "@/components/ui";
import { del, post } from "@/lib/api";
import { firstName, formatDate, todayLocal } from "@/lib/format";
import { play } from "@/lib/sound";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

/** One child on the crowning list: a leader from the board, or anyone else in the class. */
interface Pickable {
  id: number;
  fullName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  group: number | null;
}

function shiftMonth(date: string, by: number): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + by, 1)).toISOString().slice(0, 10);
}

/**
 * Vinh danh: the honour roll. The teacher picks from the ranking of a week, a month, a semester or the school
 * year, crowns the children she chooses, and the wall keeps every certificate for the class screen.
 */
export function HonoursTab({ overview }: { overview: ClassOverview }) {
  const classId = overview.class.id;
  const [period, setPeriod] = useState<HonourPeriod>("week");
  const [date, setDate] = useState(todayLocal());
  const [semester, setSemester] = useState<"" | "1" | "2">("");
  const [picked, setPicked] = useState<number[]>([]);
  const [crowning, setCrowning] = useState(false);
  const [removing, setRemoving] = useState<Honour | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [wallFilter, setWallFilter] = useState<HonourPeriod | "all">("all");
  const party = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (party.current && clearTimeout(party.current)), []);

  const q = new URLSearchParams({ period });
  if (period === "week" || period === "month") q.set("date", date);
  if (period === "semester" && semester) q.set("semester", semester);
  const board = useApi<HonourBoard>(`/api/t/classes/${classId}/honours?${q}`);
  const wall = useApi<Honour[]>(`/api/t/classes/${classId}/honours/wall`);

  // Moving to another week or term starts a fresh choice: a tick meant for last week must not follow the teacher.
  const periodId = `${period}|${date}|${semester}`;
  const [lastPeriodId, setLastPeriodId] = useState(periodId);
  if (periodId !== lastPeriodId) {
    setLastPeriodId(periodId);
    setPicked([]);
  }

  const info = HONOUR_INFO[period];
  const leaders = board.data?.leaders ?? [];
  const given = board.data?.given ?? [];
  const givenIds = new Set(given.map((g) => g.studentId));
  const inRanking = new Set(leaders.map((l) => l.studentId));
  const others = overview.students.filter((s) => !inRanking.has(s.id));

  const everyone = new Map<number, Pickable>();
  for (const s of overview.students) {
    everyone.set(s.id, { id: s.id, fullName: s.fullName, avatarEmoji: s.avatarEmoji, avatarUrl: s.avatarUrl, group: s.group });
  }
  // The board knows the freshest sticker and photo for the children it ranks.
  for (const l of leaders) {
    everyone.set(l.studentId, { id: l.studentId, fullName: l.fullName, avatarEmoji: l.avatarEmoji, avatarUrl: l.avatarUrl, group: l.group });
  }
  const chosen = picked.map((id) => everyone.get(id)).filter((p): p is Pickable => p !== undefined);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function celebrate() {
    play("win");
    setCelebrating(true);
    if (party.current) clearTimeout(party.current);
    party.current = setTimeout(() => setCelebrating(false), 4000);
  }

  const wallRows = (wall.data ?? []).filter((h) => wallFilter === "all" || h.period === wallFilter);

  return (
    <div className="grid gap-7">
      {celebrating ? <Confetti /> : null}

      <div className="no-print">
        <h1 className="text-[2rem] font-extrabold">🏆 Vinh danh</h1>
        <p className="text-ink-soft">
          Cuối tuần, cuối tháng, cuối học kỳ: cô chọn những bạn nhiều giọt nước nhất để vinh danh trước lớp. Tấm bằng khen sẽ nằm mãi ở Bảng vinh danh phía dưới.
        </p>
      </div>

      <div className="no-print grid gap-3">
        <div role="tablist" aria-label="Kỳ vinh danh" className="flex flex-wrap gap-1.5">
          {HONOUR_PERIODS.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} className="chip !min-h-[44px]" onClick={() => setPeriod(p)}>
              <span aria-hidden>{HONOUR_INFO[p].emoji}</span> {HONOUR_INFO[p].label}
            </button>
          ))}
        </div>
        {period === "week" || period === "month" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px] !px-2"
              onClick={() => setDate((d) => (period === "week" ? addDays(d, -7) : shiftMonth(d, -1)))}
              aria-label={period === "week" ? "Tuần trước" : "Tháng trước"}
            >
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm !min-h-[44px]" onClick={() => setDate(todayLocal())}>
              {period === "week" ? "Tuần này" : "Tháng này"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px] !px-2"
              onClick={() => setDate((d) => (period === "week" ? addDays(d, 7) : shiftMonth(d, 1)))}
              aria-label={period === "week" ? "Tuần sau" : "Tháng sau"}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : period === "semester" ? (
          <label className="flex items-center gap-2">
            <span className="sr-only">Chọn học kỳ</span>
            <select className="input !w-auto" value={semester} onChange={(e) => setSemester(e.target.value as "" | "1" | "2")}>
              <option value="">Học kỳ hiện tại</option>
              <option value="1">Học kỳ I</option>
              <option value="2">Học kỳ II</option>
            </select>
          </label>
        ) : null}
      </div>

      {board.error ? (
        <LoadError message={board.error} onRetry={board.reload} />
      ) : !board.data ? (
        <Loading />
      ) : (
        <div className={cn("no-print grid gap-7 transition-opacity", board.loading && "opacity-60")}>
          <section className="paper p-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-display text-2xl font-extrabold">{board.data.periodLabel}</h2>
              <p className="text-ink-soft">Bạn nào nhiều giọt nước nhất kỳ này</p>
            </div>

            {leaders.length === 0 ? (
              <p className="mt-3 rounded-xl bg-page px-3 py-4 text-ink-soft">
                Chưa bạn nào nhận giọt nước trong kỳ này. Cô chấm điểm cho các con rồi quay lại vinh danh nhé.
              </p>
            ) : (
              <>
              <Podium leaders={leaders.slice(0, 3)} picked={picked} given={givenIds} onToggle={toggle} />
              <ol className="mt-3 grid gap-2">
                {leaders.slice(3).map((l, i0) => {
                  const i = i0 + 3;
                  const on = picked.includes(l.studentId);
                  return (
                    <li key={l.studentId}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(l.studentId)}
                        className={cn(
                          "flex min-h-[56px] w-full items-center gap-2 rounded-2xl border-2 px-2 py-2 text-left",
                          on ? "border-pink-ink bg-pink-soft" : i < 3 ? "border-transparent bg-gold-soft" : "border-transparent bg-page",
                        )}
                      >
                        <span className="w-7 shrink-0 text-center font-display text-lg font-extrabold text-ink-soft">{MEDALS[i] ?? i + 1}</span>
                        <Avatar emoji={l.avatarEmoji} url={l.avatarUrl} name={l.fullName} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold leading-tight">{l.fullName}</span>
                          <span className="block text-sm text-ink-soft">
                            {givenIds.has(l.studentId) ? "✓ Đã vinh danh kỳ này" : l.group ? `Tổ ${l.group}` : "Chưa có tổ"}
                          </span>
                        </span>
                        <span className="point-count shrink-0">💧 {l.points}</span>
                        <span
                          aria-hidden
                          className={cn(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
                            on ? "border-pink-ink bg-pink-ink text-white" : "border-line",
                          )}
                        >
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              </>
            )}

            {others.length ? (
              <details className="mt-3">
                <summary className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-pink-ink">
                  <span aria-hidden>▾</span> Chọn bạn khác trong lớp
                </summary>
                <p className="text-sm text-ink-soft">Một bạn tiến bộ nhiều vẫn xứng đáng, dù chưa đứng đầu bảng.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {others.map((s) => (
                    <button key={s.id} type="button" className="chip !min-h-[44px]" aria-pressed={picked.includes(s.id)} onClick={() => toggle(s.id)}>
                      <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={22} /> {s.fullName}
                      {givenIds.has(s.id) ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary" disabled={chosen.length === 0} onClick={() => setCrowning(true)}>
                {info.emoji} Vinh danh {chosen.length ? `${chosen.length} bạn` : ""}
              </button>
              {chosen.length ? (
                <button type="button" className="btn btn-ghost btn-sm !min-h-[44px]" onClick={() => setPicked([])}>
                  Bỏ chọn
                </button>
              ) : null}
              <p className="min-w-0 flex-1 text-sm text-ink-soft">
                {chosen.length === 0 ? "Chạm vào tên bạn ở trên để chọn. Cô chọn được nhiều bạn cùng lúc." : `Sẽ vinh danh: ${chosen.map((c) => firstName(c.fullName)).join(", ")}.`}
              </p>
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="font-display text-xl font-extrabold">Đã vinh danh kỳ này</h2>
            {given.length === 0 ? (
              <p className="text-ink-soft">Chưa có bạn nào được vinh danh cho kỳ này.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {given.map((h) => (
                  <li key={h.id} className="sticker group-3 flex items-center gap-3 p-3">
                    <Avatar emoji={h.avatarEmoji} url={h.avatarUrl} name={h.fullName} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold leading-tight">{h.fullName}</span>
                      <span className="block text-sm text-ink-soft">
                        {h.title} · 💧 {h.points}
                      </span>
                      {h.note ? <span className="red-pen block text-sm leading-snug">{h.note}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px] !px-2 text-red-pen"
                      aria-label={`Gỡ danh hiệu của ${h.fullName}`}
                      title="Gỡ danh hiệu"
                      onClick={() => setRemoving(h)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-2xl font-extrabold">🖼️ Bảng vinh danh</h2>
          <button type="button" className="btn btn-ghost btn-sm no-print !min-h-[44px]" onClick={() => window.print()}>
            <Printer size={16} /> In bảng
          </button>
        </div>
        <div role="tablist" aria-label="Lọc bảng vinh danh" className="no-print flex flex-wrap gap-1.5">
          {(["all", ...HONOUR_PERIODS] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={wallFilter === k} className="chip !min-h-[44px]" onClick={() => setWallFilter(k)}>
              {k === "all" ? "Tất cả" : `${HONOUR_INFO[k].emoji} ${HONOUR_INFO[k].label}`}
            </button>
          ))}
        </div>

        {wall.error ? (
          <LoadError message={wall.error} onRetry={wall.reload} />
        ) : !wall.data ? (
          <Loading />
        ) : wallRows.length === 0 ? (
          <Empty emoji="🏆" title="Chưa có bạn nào được vinh danh…">
            {wallFilter === "all"
              ? "Cô chọn bạn ở bảng trên rồi bấm “Vinh danh”. Tấm bằng khen đầu tiên sẽ hiện ở đây cho cả lớp cùng xem."
              : "Chưa có danh hiệu nào ở mục này. Cô thử xem mục khác nhé."}
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {wallRows.map((h) => (
              <li
                key={h.id}
                className="relative overflow-hidden rounded-3xl border-[3px] border-gold bg-paper px-4 py-5 text-center shadow-[0_5px_0_1px_#f0d78a]"
              >
                <span aria-hidden className="pointer-events-none absolute inset-2 rounded-2xl border border-dashed border-[#f0d78a]" />
                <div className="relative grid justify-items-center gap-1">
                  <span className="text-3xl" aria-hidden>
                    {HONOUR_INFO[h.period].emoji}
                  </span>
                  <Avatar emoji={h.avatarEmoji} url={h.avatarUrl} name={h.fullName} size={72} className="ring-4 ring-gold-soft" />
                  <p className="mt-1 font-display text-xl font-extrabold leading-tight text-gold-ink">{h.title}</p>
                  <p className="text-lg font-bold leading-tight break-words">{h.fullName}</p>
                  <p className="text-sm text-ink-soft break-words">{h.periodLabel}</p>
                  {h.note ? <p className="red-pen mt-1 text-[1.05rem] leading-snug break-words">“{h.note}”</p> : null}
                  <p className="point-count mt-1">💧 {h.points} điểm</p>
                  <p className="text-xs text-ink-soft">Vinh danh ngày {formatDate(h.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CrownSheet
        open={crowning}
        classId={classId}
        period={period}
        periodLabel={board.data?.periodLabel ?? ""}
        date={date}
        semester={semester}
        chosen={chosen}
        onToggle={toggle}
        onClose={() => setCrowning(false)}
        onDone={(list) => {
          board.setData((d) => (d ? { ...d, given: list } : d));
          void wall.reload();
          setPicked([]);
          setCrowning(false);
          celebrate();
        }}
      />

      <Confirm
        open={removing !== null}
        title="Gỡ khỏi bảng vinh danh?"
        danger
        body={
          <p>
            Gỡ danh hiệu <strong>{removing?.title}</strong> của <strong>{removing?.fullName}</strong> ({removing?.periodLabel}). Giọt nước của con vẫn giữ nguyên.
          </p>
        }
        action="Gỡ danh hiệu"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const h = removing;
          if (!h) return;
          const r = await del(`/api/t/honours/${h.id}`);
          if (!r.ok) return toast(r.message, "error");
          toast(`Đã gỡ danh hiệu của ${h.fullName}.`);
          setRemoving(null);
          void board.reload();
          void wall.reload();
        }}
      />
    </div>
  );
}

/**
 * "3 bạn đứng đầu sẽ thể hiện như dưới đây, từ 4 đến 50 xếp theo danh sách" (brief 3, item 7, with a screenshot).
 * Quán quân stands in the middle and highest, Á quân 1 to the left, Á quân 2 to the right — and on a phone, where
 * there is no room to stand side by side, they simply come first, second, third.
 */
function Podium({
  leaders,
  picked,
  given,
  onToggle,
}: {
  leaders: HonourBoard["leaders"];
  picked: number[];
  given: Set<number>;
  onToggle(id: number): void;
}) {
  const [first, second, third] = leaders;
  // On a wide screen: 2nd, 1st, 3rd. On a phone the natural order reads better.
  const order = [second, first, third].filter((l): l is HonourBoard["leaders"][number] => l !== undefined);
  const rank = (l: HonourBoard["leaders"][number]) => leaders.indexOf(l) + 1;
  const TITLES = ["👑 Quán quân", "🥈 Á quân 1", "🥉 Á quân 2"];
  const HEIGHT = ["sm:mt-0", "sm:mt-8", "sm:mt-12"];

  return (
    <ol className="mt-4 grid items-end gap-3 sm:grid-cols-3">
      {order.map((l) => {
        const place = rank(l);
        const on = picked.includes(l.studentId);
        return (
          <li key={l.studentId} className={cn("sm:order-none", HEIGHT[place - 1], place === 1 && "order-first")}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(l.studentId)}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-3xl border-[3px] px-3 pb-4 pt-3 text-center",
                place === 1 ? "border-gold bg-gold-soft shadow-[0_5px_0_1px_#f0d78a]" : "border-line bg-paper",
                on && "!border-pink-ink bg-pink-soft",
              )}
            >
              <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-bold", place === 1 ? "bg-gold" : "bg-page")}>{TITLES[place - 1]}</span>
              <Avatar
                emoji={l.avatarEmoji}
                url={l.avatarUrl}
                name={l.fullName}
                size={place === 1 ? 88 : 66}
                className={cn("mt-1", place === 1 ? "ring-4 ring-gold" : "ring-2 ring-white")}
              />
              <span className={cn("font-display font-extrabold leading-tight", place === 1 ? "text-xl" : "text-lg")}>{l.fullName}</span>
              <span className="text-sm text-ink-soft">{l.group ? `Tổ ${l.group}` : "Chưa có tổ"}</span>
              <span className="point-count text-lg">💧 {l.points}</span>
              {given.has(l.studentId) ? <span className="text-sm text-mint-ink">✓ Đã vinh danh kỳ này</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function CrownSheet({
  open,
  classId,
  period,
  periodLabel,
  date,
  semester,
  chosen,
  onToggle,
  onClose,
  onDone,
}: {
  open: boolean;
  classId: number;
  period: HonourPeriod;
  periodLabel: string;
  date: string;
  semester: "" | "1" | "2";
  chosen: Pickable[];
  onToggle(id: number): void;
  onClose(): void;
  onDone(list: Honour[]): void;
}) {
  const info = HONOUR_INFO[period];
  const [title, setTitle] = useState(info.title);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  // A fresh form each time the sheet opens: the default title of this kind of honour, and no old praise.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(info.title);
      setNote("");
      setError(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${info.emoji} Vinh danh`}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || chosen.length === 0}
          onClick={async () => {
            const t = title.trim();
            const body = {
              studentIds: chosen.map((c) => c.id),
              period,
              note: note.trim(),
              ...(t ? { title: t } : {}),
              ...(period === "week" || period === "month" ? { date } : {}),
              ...(period === "semester" && semester ? { semester } : {}),
            };
            setBusy(true);
            const r = await post<Honour[]>(`/api/t/classes/${classId}/honours`, body);
            setBusy(false);
            if (!r.ok) return setError(r.message);
            toast(chosen.length === 1 ? `🎉 Đã vinh danh ${chosen[0]!.fullName}!` : `🎉 Đã vinh danh ${chosen.length} bạn!`);
            onDone(r.data);
          }}
        >
          Vinh danh {chosen.length} bạn
        </button>
      }
    >
      <div className="grid gap-4">
        <p className="text-ink-soft">
          Kỳ vinh danh: <strong className="text-ink">{periodLabel}</strong>
        </p>
        <div>
          <p className="mb-1.5 font-semibold">Các bạn được vinh danh</p>
          <div className="flex flex-wrap gap-1.5">
            {chosen.map((c) => (
              <button key={c.id} type="button" className="chip !min-h-[44px]" aria-pressed onClick={() => onToggle(c.id)} title={`Bỏ ${c.fullName} khỏi danh sách`}>
                <Avatar emoji={c.avatarEmoji} url={c.avatarUrl} name={c.fullName} size={22} /> {c.fullName} ✕
              </button>
            ))}
          </div>
          {chosen.length === 0 ? <p className="text-sm text-ink-soft">Chưa chọn bạn nào. Cô đóng bảng này rồi chọn lại nhé.</p> : null}
        </div>
        <Field
          label="Danh hiệu"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={info.title}
          hint="Để nguyên cũng được, hoặc cô đặt tên riêng cho lớp mình."
          data-autofocus
        />
        <TextArea
          label="Lời khen của cô (không bắt buộc)"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vì con tiến bộ rõ rệt"
          hint="Lời khen này hiện trên tấm bằng khen của con."
        />
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
