"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Search, Users } from "lucide-react";
import { levelFor, type ClassOverview, type LeaderRow, type PointEvent, type PointsResult } from "@lhhp/shared";
import { Leaderboard } from "@/components/leaderboard";
import { Sheet, toast } from "@/components/ui";
import { firstName, formatNumber, signed, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClassCover } from "./cover";
import { CallOnSomeone, GroupSplit } from "./games";
import { HistorySheet } from "./history";
import { LevelUpDialog, QuickScoreSheet, StickerCard, StudentListRow, UndoBar, sendPoints, type Burst } from "./score";

type Sort = "list" | "name" | "drops";
type Layout = "list" | "grid";
const LAYOUT_KEY = "lhhp-vuon-hoa-layout";

export function HomeTab({
  overview,
  setOverview,
  reload,
  goTo,
}: {
  overview: ClassOverview;
  setOverview(fn: (o: ClassOverview) => ClassOverview): void;
  reload(): void;
  goTo(tab: string): void;
}) {
  const cls = overview.class;
  const [group, setGroup] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("list");
  // She asked for the class as a vertical list (brief 3, item 8); the sticker grid stays one tap away.
  const [layout, setLayout] = useState<Layout>("list");
  useEffect(() => {
    try {
      if (localStorage.getItem(LAYOUT_KEY) === "grid") setLayout("grid");
    } catch {
      // A browser that refuses storage simply opens on the list.
    }
  }, []);
  const chooseLayout = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Not worth telling her about: the choice just won't be remembered.
    }
  };
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bursts, setBursts] = useState<Record<number, Burst[]>>({});
  const [menuFor, setMenuFor] = useState<number[] | null>(null);
  const [last, setLast] = useState<{ result: PointsResult; label: string } | null>(null);
  const [levelUps, setLevelUps] = useState<{ fullName: string; level: number; url: string | null; emoji: string }[]>([]);
  const [tool, setTool] = useState<"pick" | "split" | "history" | null>(null);
  const burstId = useRef(0);
  const dismissLast = useCallback(() => setLast(null), []);

  const students = overview.students;
  // "Nhiều giọt nước nhất" is ranked when chosen, then held still: a sticker must not slide away from under the teacher's
  // finger between two taps. Choosing the sort again re-ranks.
  const [dropsOrder, setDropsOrder] = useState<number[]>([]);
  const rankByDrops = useCallback(() => setDropsOrder([...students].sort((a, b) => b.points - a.points).map((s) => s.id)), [students]);
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    let list = students.filter(
      (s) => (group === "all" || s.group === group) && (!q || s.fullName.toLocaleLowerCase("vi").includes(q) || s.username.toLowerCase().includes(q)),
    );
    if (sort === "name") list = [...list].sort((a, b) => firstName(a.fullName).localeCompare(firstName(b.fullName), "vi"));
    if (sort === "drops") {
      const rank = new Map(dropsOrder.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
    }
    return list;
  }, [students, group, query, sort, dropsOrder]);

  const weekTop: LeaderRow[] = useMemo(
    () =>
      students
        .filter((s) => s.weekPoints > 0)
        .sort((a, b) => b.weekPoints - a.weekPoints || a.fullName.localeCompare(b.fullName, "vi"))
        .slice(0, 10)
        .map((s) => ({ studentId: s.id, fullName: s.fullName, avatarEmoji: s.avatarEmoji, avatarUrl: s.avatarUrl, group: s.group, points: s.weekPoints })),
    [students],
  );
  const noDropsYet = useMemo(() => students.filter((s) => s.weekPoints <= 0), [students]);

  const addBurst = (ids: number[], delta: number) => {
    const id = ++burstId.current;
    setBursts((b) => {
      const next = { ...b };
      for (const sid of ids) next[sid] = [...(next[sid] ?? []), { id, delta }];
      return next;
    });
    setTimeout(
      () =>
        setBursts((b) => {
          const next = { ...b };
          for (const sid of ids) next[sid] = (next[sid] ?? []).filter((x) => x.id !== id);
          return next;
        }),
      900,
    );
  };

  /**
   * Moves the numbers on screen before the server answers. `drops` (what the level counts) only grows with plus points,
   * so undoing or rolling back needs its own change: undoing +1 takes a drop away, undoing −1 gives none back.
   */
  const applyDelta = useCallback(
    (ids: number[], delta: number, starsDelta: number = delta > 0 ? delta : 0) =>
      setOverview((o) => ({
        ...o,
        students: o.students.map((s) =>
          ids.includes(s.id)
            ? {
                ...s,
                points: s.points + delta,
                weekPoints: s.weekPoints + delta,
                drops: s.drops + starsDelta,
                level: levelFor(s.drops + starsDelta).level,
              }
            : s,
        ),
        stats: {
          ...o.stats,
          todayPoints: o.stats.todayPoints + delta * ids.length,
          totalPoints: o.stats.totalPoints + delta * ids.length,
        },
      })),
    [setOverview],
  );

  async function score(ids: number[], delta: number, reasonId?: number) {
    applyDelta(ids, delta);
    addBurst(ids, delta);
    const r = await sendPoints(cls.id, ids, delta, reasonId);
    if (!r.ok) {
      applyDelta(ids, -delta, delta > 0 ? -delta : 0);
      toast(r.message, "error");
      return;
    }
    const names = ids.length === 1 ? firstName(students.find((s) => s.id === ids[0])?.fullName ?? "") : `${ids.length} bạn`;
    const reason = r.data.events[0]?.reason;
    setLast({ result: r.data, label: `${names} ${signed(delta)} 💧${reasonId && reason ? `, ${reason}` : ""}` });
    setOverview((o) => ({
      ...o,
      recent: [...r.data.events, ...o.recent].slice(0, 12),
      stats: { ...o.stats, kindness: o.stats.kindness + r.data.events.filter((e) => e.delta > 0 && e.category === "yeu_thuong").length },
      recentBadges: [
        ...r.data.newBadges.map((b) => ({
          studentId: b.studentId,
          fullName: o.students.find((s) => s.id === b.studentId)?.fullName ?? "",
          key: b.key,
          awardedAt: new Date().toISOString(),
        })),
        ...o.recentBadges,
      ].slice(0, 8),
    }));
    if (r.data.levelUps.length) {
      setLevelUps((q) => [
        ...q,
        ...r.data.levelUps.map((l) => {
          const s = students.find((x) => x.id === l.studentId);
          return { fullName: l.fullName, level: l.level, url: s?.avatarUrl ?? null, emoji: s?.avatarEmoji ?? "💧" };
        }),
      ]);
    }
    for (const b of r.data.newBadges) {
      const def = overview.badgeDefs.find((d) => d.key === b.key);
      const s = students.find((x) => x.id === b.studentId);
      if (def && s) toast(`${def.emoji} ${firstName(s.fullName)} nhận huy hiệu “${def.name}”!`);
    }
  }

  const toggle = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const menuStudents = menuFor ? students.filter((s) => menuFor.includes(s.id)) : [];

  return (
    <div className="grid gap-6">
      <ClassCover overview={overview} onChange={(c) => setOverview((o) => ({ ...o, class: c }))} />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Hôm nay">
        <Stat emoji="💧" value={`${overview.stats.todayPoints > 0 ? "+" : ""}${formatNumber(overview.stats.todayPoints)}`} label="giọt nước hôm nay" />
        <Stat emoji="💖" value={formatNumber(overview.stats.kindness)} label="lần yêu thương" />
        <Stat emoji="📚" value={String(overview.stats.openTasks)} label="nhiệm vụ đang giao" onClick={() => goTo("nhiem-vu")} />
        <Stat
          emoji="💌"
          value={String(overview.stats.unreadMessages)}
          label="lời nhắn mới của phụ huynh"
          onClick={() => goTo("loi-nhan")}
          highlight={overview.stats.unreadMessages > 0}
        />
      </ul>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <section aria-labelledby="garden" className="paper p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="garden" className="mr-auto text-[1.8rem] font-extrabold">
              👧👦 Vườn hoa của lớp
            </h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTool("pick")}>
              🎲 Gọi ngẫu nhiên
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTool("split")}>
              <Users size={16} /> Chia nhóm
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTool("history")}>
              <History size={16} /> Lịch sử
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Lọc theo tổ" className="flex flex-wrap gap-1.5">
              <button type="button" role="tab" className="chip" aria-selected={group === "all"} onClick={() => setGroup("all")}>
                Tất cả
              </button>
              {cls.teams.map((t, i) => (
                <button key={i} type="button" role="tab" className="chip" aria-selected={group === i + 1} onClick={() => setGroup(i + 1)}>
                  <span aria-hidden>{t.emoji}</span> Tổ {i + 1}
                </button>
              ))}
            </div>
            <label className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[240px]">
              <span className="sr-only">Tìm học sinh</span>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input className="input !min-h-[38px] !rounded-full !py-1 pl-9" placeholder="Tìm học sinh…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>
              <span className="sr-only">Sắp xếp</span>
              <select
                className="input !min-h-[38px] !w-auto !rounded-full !py-1 text-sm"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);
                  if (e.target.value === "drops") rankByDrops();
                }}
              >
                <option value="list">Theo danh sách lớp</option>
                <option value="name">Theo tên (A–Z)</option>
                <option value="drops">Nhiều giọt nước nhất</option>
              </select>
            </label>
            {sort === "drops" ? (
              <button type="button" className="chip" onClick={rankByDrops} title="Xếp lại theo số giọt nước hiện tại">
                ↻ Xếp lại
              </button>
            ) : null}
            <div role="group" aria-label="Kiểu hiển thị" className="flex gap-1.5">
              <button type="button" className="chip" aria-pressed={layout === "list"} onClick={() => chooseLayout("list")}>
                ☰ Danh sách
              </button>
              <button type="button" className="chip" aria-pressed={layout === "grid"} onClick={() => chooseLayout("grid")}>
                ▦ Ô vuông
              </button>
            </div>
            <button
              type="button"
              className="chip"
              aria-pressed={selectMode}
              onClick={() => {
                setSelectMode((m) => !m);
                setSelected(new Set());
              }}
            >
              ☑️ Chọn nhiều bạn
            </button>
          </div>

          {selectMode ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-pink-soft px-3 py-2">
              <span className="text-sm font-semibold">Chọn nhanh:</span>
              <button type="button" className="chip !min-h-[32px]" onClick={() => setSelected(new Set(shown.map((s) => s.id)))}>
                Cả lớp đang hiện
              </button>
              {cls.teams.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className="chip !min-h-[32px]"
                  onClick={() => setSelected(new Set(students.filter((s) => s.group === i + 1).map((s) => s.id)))}
                >
                  Tổ {i + 1}
                </button>
              ))}
              <button type="button" className="chip !min-h-[32px]" onClick={() => setSelected(new Set())}>
                Bỏ chọn
              </button>
            </div>
          ) : null}

          {students.length === 0 ? (
            <div className="mt-6 grid place-items-center rounded-xl border-2 border-dashed border-line px-4 py-10 text-center">
              <p className="text-4xl" aria-hidden>
                🌱
              </p>
              <p className="mt-2 font-display text-xl font-bold">Vườn hoa đang chờ các bạn nhỏ</p>
              <p className="mt-1 text-ink-soft">Thêm danh sách học sinh để bắt đầu chấm điểm.</p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => goTo("tai-khoan")}>
                Thêm học sinh
              </button>
            </div>
          ) : (
            <ul aria-label="Học sinh của lớp" className={cn("mt-5", layout === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-4 gap-y-6" : "grid gap-2")}>
              {shown.map((s) => {
                const props = {
                  s,
                  bursts: bursts[s.id] ?? [],
                  selectMode,
                  selected: selected.has(s.id),
                  onToggle: () => toggle(s.id),
                  onScore: (d: number) => score([s.id], d),
                  onMenu: () => setMenuFor([s.id]),
                };
                return layout === "grid" ? <StickerCard key={s.id} {...props} /> : <StudentListRow key={s.id} {...props} />;
              })}
            </ul>
          )}
          {shown.length === 0 && students.length > 0 ? <p className="py-8 text-center text-ink-soft">Không có bạn nào khớp.</p> : null}
        </section>

        <aside className="grid gap-6">
          <Leaderboard rows={weekTop} />
          <section className="paper p-4">
            <h2 className="text-xl font-extrabold">Hoạt động gần đây</h2>
            {overview.recent.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Bấm +💧 trên sticker để chấm điểm đầu tiên.</p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {overview.recent.slice(0, 7).map((e: PointEvent) => (
                  <li key={e.id} className="flex items-baseline gap-2 text-[0.92rem]">
                    <span className={cn("w-8 shrink-0 text-right font-bold", e.delta > 0 ? "text-gold-ink" : "text-red-pen")}>{signed(e.delta)}</span>
                    <span className="min-w-0 flex-1">
                      <strong>{firstName(e.studentName)}</strong> <span className="text-ink-soft">{e.reason}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">{timeAgo(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {noDropsYet.length > 0 && students.length > 0 ? (
            <section className="paper p-4">
              <h2 className="text-xl font-extrabold">Cần cô động viên</h2>
              <p className="text-sm text-ink-soft">Tuần này các bạn chưa có giọt nước nào.</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {noDropsYet.slice(0, 16).map((s) => (
                  <li key={s.id}>
                    <button type="button" className="chip !min-h-[32px] text-sm" onClick={() => setMenuFor([s.id])}>
                      {s.avatarEmoji} {firstName(s.fullName)}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {overview.recentBadges.length > 0 ? (
            <section className="paper p-4">
              <h2 className="text-xl font-extrabold">Huy hiệu mới</h2>
              <ul className="mt-2 grid gap-1.5 text-[0.92rem]">
                {overview.recentBadges.slice(0, 5).map((b, i) => {
                  const def = overview.badgeDefs.find((d) => d.key === b.key);
                  return def ? (
                    <li key={i}>
                      <span aria-hidden>{def.emoji}</span> <strong>{firstName(b.fullName)}</strong> nhận “{def.name}”
                    </li>
                  ) : null;
                })}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {selectMode && selected.size > 0 ? (
        <div className="no-print fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
          <div className="pop-in flex items-center gap-3 rounded-2xl bg-ink px-4 py-2.5 text-white shadow-xl">
            <span className="font-semibold">Đã chọn {selected.size} bạn</span>
            <button type="button" className="btn btn-gold btn-sm" onClick={() => setMenuFor([...selected])}>
              Chấm điểm
            </button>
          </div>
        </div>
      ) : null}

      <QuickScoreSheet
        open={menuFor !== null}
        students={menuStudents}
        reasons={overview.reasons}
        onClose={() => setMenuFor(null)}
        onScore={(d, reasonId) => {
          const ids = menuFor ?? [];
          void score(ids, d, reasonId);
          if (selectMode) setSelected(new Set());
        }}
      />
      <UndoBar
        last={last}
        reasons={overview.reasons}
        classId={cls.id}
        raised={selectMode && selected.size > 0}
        onDismiss={dismissLast}
        onUndone={(res) => {
          setLast(null);
          const d = res.events[0]?.delta ?? 0;
          applyDelta(
            res.events.map((e) => e.studentId),
            -d,
            d > 0 ? -d : 0,
          );
          const kind = res.events.filter((e) => e.delta > 0 && e.category === "yeu_thuong").length;
          setOverview((o) => ({
            ...o,
            recent: o.recent.filter((e) => e.batchId !== res.batchId),
            stats: { ...o.stats, kindness: o.stats.kindness - kind },
          }));
        }}
        onReasoned={(events) => {
          const kind = events.filter((e) => e.delta > 0 && e.category === "yeu_thuong").length;
          setOverview((o) => ({
            ...o,
            recent: o.recent.map((e) => events.find((x) => x.id === e.id) ?? e),
            stats: { ...o.stats, kindness: o.stats.kindness + kind },
          }));
        }}
      />
      <LevelUpDialog item={levelUps[0] ?? null} onClose={() => setLevelUps((q) => q.slice(1))} />

      <Sheet open={tool === "pick"} onClose={() => setTool(null)} title="🎲 Gọi ngẫu nhiên" wide>
        <CallOnSomeone students={students} onDrop={(s) => score([s.id], 1)} />
      </Sheet>
      <Sheet open={tool === "split"} onClose={() => setTool(null)} title="👥 Chia nhóm" wide>
        <GroupSplit students={students} />
      </Sheet>
      <HistorySheet open={tool === "history"} onClose={() => setTool(null)} classId={cls.id} reasons={overview.reasons} onChanged={reload} />
    </div>
  );
}

function Stat({ emoji, value, label, onClick, highlight }: { emoji: string; value: string; label: string; onClick?(): void; highlight?: boolean }) {
  const inner = (
    <>
      <span aria-hidden className="text-2xl">
        {emoji}
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[1.6rem] font-extrabold">{value}</span>
        <span className="text-sm text-ink-soft">{label}</span>
      </span>
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className={cn("paper flex w-full items-center gap-3 px-4 py-3 text-left hover:border-pink", highlight && "border-pink bg-pink-soft")}>
          {inner}
        </button>
      ) : (
        <div className="paper flex items-center gap-3 px-4 py-3">{inner}</div>
      )}
    </li>
  );
}
