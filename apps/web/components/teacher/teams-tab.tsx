"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClassDetail, ClassOverview, Seating, StudentRow, Team, TeamRace } from "@lhhp/shared";
import { Avatar, Field, Loading, LoadError, Sheet, toast } from "@/components/ui";
import { api, patch, put } from "@/lib/api";
import { firstName } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn, groupClass } from "@/lib/utils";

export function TeamsTab({
  overview,
  setOverview,
}: {
  overview: ClassOverview;
  setOverview(fn: (o: ClassOverview) => ClassOverview): void;
}) {
  const cls = overview.class;
  const [editing, setEditing] = useState<number | null>(null);
  const teams = cls.teams.map((t, i) => {
    const members = overview.students.filter((s) => s.group === i + 1);
    const total = members.reduce((n, s) => n + s.points, 0);
    const week = members.reduce((n, s) => n + s.weekPoints, 0);
    return { ...t, no: i + 1, members, total, week, avg: members.length ? Math.round((total / members.length) * 10) / 10 : 0 };
  });
  const bestWeek = Math.max(...teams.map((t) => t.week));
  const unassigned = overview.students.filter((s) => !s.group);

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <h1 className="text-[2rem] font-extrabold">🪑 Tổ thi đua</h1>
        {unassigned.length ? (
          <p className="text-ink-soft">
            {unassigned.length} bạn chưa có tổ. Xếp tổ trong mục Học sinh, hoặc dùng nút “Xếp theo tổ” ở sơ đồ lớp bên dưới.
          </p>
        ) : null}
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {teams.map((t) => {
            const leader = overview.students.find((s) => s.id === t.leaderId);
            const deputy = overview.students.find((s) => s.id === t.deputyId);
            return (
              <li key={t.no} className={cn("sticker relative p-4", `group-${t.no}`)}>
                {t.week > 0 && t.week === bestWeek ? (
                  <span className="absolute -top-3 right-3 rounded-full bg-gold px-2 py-0.5 text-sm font-bold shadow-[0_2px_0_#d9ad16]">👑 Dẫn đầu tuần</span>
                ) : null}
                <p className="text-4xl" aria-hidden>
                  {t.emoji}
                </p>
                <h2 className="mt-1 text-xl font-extrabold leading-tight">
                  Tổ {t.no}: {t.name}
                </h2>
                <p className="text-sm text-ink-soft">{t.members.length} thành viên</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-page py-1.5">
                    <dt className="text-xs text-ink-soft">Tuần này</dt>
                    <dd className="text-lg font-semibold">{t.week}</dd>
                  </div>
                  <div className="rounded-xl bg-page py-1.5">
                    <dt className="text-xs text-ink-soft">Tổng giọt nước</dt>
                    <dd className="text-lg font-semibold">{t.total}</dd>
                  </div>
                  <div className="rounded-xl bg-page py-1.5">
                    <dt className="text-xs text-ink-soft">Mỗi bạn</dt>
                    <dd className="text-lg font-semibold">{t.avg}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm">
                  Tổ trưởng: <strong>{leader ? leader.fullName : "chưa chọn"}</strong>
                  <br />
                  Tổ phó: <strong>{deputy ? deputy.fullName : "chưa chọn"}</strong>
                </p>
                <ul className="mt-3 flex flex-wrap gap-1">
                  {t.members.map((s) => (
                    <li key={s.id} title={s.fullName}>
                      <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={30} />
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => setEditing(t.no)}>
                  Sửa tổ
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <TeamRaceBoard classId={cls.id} />

      <SeatingChart overview={overview} />

      <TeamEditor
        open={editing !== null}
        index={editing ?? 1}
        cls={cls}
        students={overview.students}
        onClose={() => setEditing(null)}
        onSaved={(c, rows) => setOverview((o) => ({ ...o, class: c, students: rows ?? o.students }))}
      />
    </div>
  );
}

const RACE_PERIODS = [
  { id: "week", label: "Tuần này" },
  { id: "month", label: "Tháng này" },
  { id: "semester", label: "Học kỳ" },
  { id: "year", label: "Năm học" },
] as const;

/** Thi đua theo tổ: the same race counted over a week, a month, a semester or the whole school year. */
function TeamRaceBoard({ classId }: { classId: number }) {
  const [period, setPeriod] = useState<(typeof RACE_PERIODS)[number]["id"]>("week");
  const { data, error, reload } = useApi<TeamRace>(`/api/t/classes/${classId}/teams?period=${period}`);
  const racing = data?.standings.filter((t) => t.members > 0) ?? [];
  const most = Math.max(1, ...racing.map((t) => t.points));

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[1.6rem] font-extrabold">🏁 Bảng thi đua các tổ</h2>
        <div role="tablist" aria-label="Khoảng thời gian" className="flex flex-wrap gap-1.5">
          {RACE_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              className="chip !min-h-[44px]"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : racing.length === 0 ? (
        <p className="text-ink-soft">Chưa tổ nào có bạn nào. Xếp tổ cho các con rồi quay lại nhé.</p>
      ) : (
        <>
          <p className="text-ink-soft">{data.period.label}</p>
          <ol className="grid gap-2">
            {racing.map((t, i) => (
              <li key={t.group} className={cn("sticker flex items-center gap-3 p-3", `group-${t.group}`)}>
                <span className="w-7 shrink-0 text-center text-xl font-extrabold" aria-hidden>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <span className="text-3xl" aria-hidden>
                  {t.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-extrabold leading-tight">
                    Tổ {t.group}: {t.name}
                  </span>
                  <span className="mt-1 block h-2.5 rounded-full bg-page" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-gold"
                      style={{ width: `${Math.max(0, (t.points / most) * 100)}%` }}
                    />
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {t.members} bạn · mỗi bạn {t.average} điểm · cộng {t.plus}, trừ {t.minus}
                  </span>
                </span>
                <span className="point-count shrink-0 text-xl" aria-label={`${t.points} điểm`}>
                  💧 {t.points}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/**
 * "Sửa tổ" now edits the tổ itself: its name, its mascot, who leads it, and **who is in it** —
 * "chưa sửa đc thành viên các tổ" (brief 3, item 5). Before this she had to open each child in Học sinh.
 */
function TeamEditor({
  open,
  index,
  cls,
  students,
  onClose,
  onSaved,
}: {
  open: boolean;
  index: number;
  cls: ClassDetail;
  students: StudentRow[];
  onClose(): void;
  onSaved(c: ClassDetail, students: StudentRow[] | null): void;
}) {
  const [t, setT] = useState<Team>(cls.teams[index - 1]!);
  /** Who is in this tổ once she saves. Starts as it is now. */
  const [members, setMembers] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setT(cls.teams[index - 1]!);
    setMembers(new Set(students.filter((s) => s.group === index).map((s) => s.id)));
  }, [open, index, cls, students]);

  const chosen = students.filter((s) => members.has(s.id));
  // Only the children joining this tổ are sent. Nobody can be left without a tổ.
  const moves = students.filter((s) => s.group !== index && members.has(s.id)).map((s) => ({ studentId: s.id, group: index }));

  /** A child already in this tổ stays until another tổ takes them: that is what keeps every child in one. */
  const toggle = (id: number, alreadyHere: boolean) => {
    if (alreadyHere) return;
    setMembers((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function save() {
    setBusy(true);
    // The tổ first, then its members: if the second call fails, nobody is left in a tổ that was never renamed.
    const teams = cls.teams.map((x, i) => (i === index - 1 ? { ...t, leaderId: leaderOf(t.leaderId), deputyId: leaderOf(t.deputyId) } : x));
    const saved = await patch<ClassDetail>(`/api/t/classes/${cls.id}`, { teams });
    if (!saved.ok) {
      setBusy(false);
      return toast(saved.message, "error");
    }
    let rows: StudentRow[] | null = null;
    if (moves.length) {
      const moved = await patch<StudentRow[]>(`/api/t/classes/${cls.id}/groups`, { moves });
      if (!moved.ok) {
        setBusy(false);
        onSaved(saved.data, null);
        return toast(moved.message, "error");
      }
      rows = moved.data;
    }
    setBusy(false);
    onSaved(saved.data, rows);
    toast(moves.length ? `Đã lưu tổ và chuyển ${moves.length} bạn sang tổ ${index}.` : "Đã lưu tổ.");
    onClose();
  }

  /** A tổ trưởng who has just been moved out of the tổ is no longer its leader. */
  function leaderOf(id: number | null): number | null {
    return id !== null && members.has(id) ? id : null;
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={`Sửa Tổ ${index}`}
      footer={
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
      }
    >
      <div className="grid gap-4">
        <Field label="Tên tổ" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        <fieldset>
          <legend className="mb-2 font-semibold">Linh vật</legend>
          <div className="flex flex-wrap gap-1.5">
            {["🐰", "🐦", "🐿️", "🐘", "🐬", "🐝", "🐱", "🐼", "🦊", "🐯", "🦁", "🐸", "🦄", "🐧", "🐢", "🦋"].map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={t.emoji === e}
                onClick={() => setT({ ...t, emoji: e })}
                className={cn("grid h-11 w-11 place-items-center rounded-xl text-2xl", t.emoji === e ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page")}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-semibold">Thành viên của tổ {index} ({chosen.length} bạn)</legend>
          <p className="mb-2 text-sm text-ink-soft">
            Chạm vào tên một bạn ở tổ khác để chuyển bạn sang tổ {index}. Bạn nào cũng phải ở trong một tổ, nên muốn
            đưa một bạn ra thì cô mở tổ mới của bạn ấy rồi chọn tên bạn.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {students.map((s) => {
              const alreadyHere = s.group === index;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={cn("chip !min-h-[44px]", alreadyHere && "cursor-default")}
                  aria-pressed={members.has(s.id)}
                  aria-disabled={alreadyHere || undefined}
                  title={alreadyHere ? `${s.fullName} đang ở tổ ${index}` : `Chuyển ${s.fullName} sang tổ ${index}`}
                  onClick={() => toggle(s.id, alreadyHere)}
                >
                  <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={24} />
                  {s.fullName}
                  {!alreadyHere ? <span className="text-ink-soft">· Tổ {s.group}</span> : null}
                </button>
              );
            })}
          </div>
          {moves.length ? (
            <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 text-sm">
              {moves.length} bạn sẽ chuyển sang tổ {index} khi cô bấm Lưu.
            </p>
          ) : null}
        </fieldset>

        {(["leaderId", "deputyId"] as const).map((k) => (
          <label key={k} className="field">
            <span>{k === "leaderId" ? "Tổ trưởng" : "Tổ phó"}</span>
            <select className="input" value={t[k] ?? ""} onChange={(e) => setT({ ...t, [k]: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Chưa chọn</option>
              {chosen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </label>
        ))}
        {chosen.length === 0 ? <p className="text-sm text-ink-soft">Tổ chưa có thành viên để chọn tổ trưởng.</p> : null}
      </div>
    </Sheet>
  );
}

const key = (r: number, d: number, k: number) => `${r}-${d}-${k}`;

/** The classroom from the teacher's desk: the board at the front, rows (dãy) of desks (bàn). */
function SeatingChart({ overview }: { overview: ClassOverview }) {
  const cls = overview.class;
  const [seating, setSeating] = useState<Seating | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const byId = useMemo(() => new Map(overview.students.map((s) => [s.id, s])), [overview.students]);

  const load = () => {
    setLoadError(null);
    void api<Seating>(`/api/t/classes/${cls.id}/seating`).then((r) => (r.ok ? setSeating(r.data) : setLoadError(r.message)));
  };
  useEffect(load, [cls.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every change is saved on its own a moment later, so nothing is lost by switching tab.
  const pending = useRef<Seating | null>(null);
  const save = async (next: Seating) => {
    pending.current = null;
    setSaving("saving");
    const r = await put<Seating>(`/api/t/classes/${cls.id}/seating`, next);
    setSaving(r.ok ? "saved" : "error");
    if (!r.ok) toast(r.message, "error");
  };
  // Leaving the tab (or the page) sends whatever is still waiting, instead of dropping it.
  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      const body = JSON.stringify(pending.current);
      pending.current = null;
      void fetch(`/api/t/classes/${cls.id}/seating`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
        credentials: "same-origin",
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", flush);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [cls.id]);

  if (loadError) return <LoadError message={loadError} onRetry={load} />;
  if (!seating) return <Loading />;
  const seated = new Set(Object.values(seating.seats));
  const unseated = overview.students.filter((s) => !seated.has(s.id));

  const update = (next: Seating) => {
    setSeating(next);
    setSaving("saving");
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 500);
  };

  function autoArrange(mode: "group" | "random") {
    const list = [...overview.students];
    if (mode === "group") list.sort((a, b) => (a.group ?? 99) - (b.group ?? 99));
    else list.sort(() => Math.random() - 0.5);
    const seats: Record<string, number> = {};
    let i = 0;
    // Fill front to back, row by row, so each group sits together.
    for (let r = 1; r <= seating!.rows; r++)
      for (let d = 1; d <= seating!.desks; d++)
        for (let k = 1; k <= seating!.seatsPerDesk; k++) {
          const s = list[i++];
          if (s) seats[key(r, d, k)] = s.id;
        }
    update({ ...seating!, seats });
  }

  const pickingStudent = picking ? byId.get(seating.seats[picking] ?? -1) : undefined;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[1.8rem] font-extrabold">Sơ đồ lớp</h2>
        {(
          [
            ["rows", "Số dãy", 1, 6],
            ["desks", "Bàn mỗi dãy", 1, 8],
            ["seatsPerDesk", "Chỗ mỗi bàn", 1, 3],
          ] as const
        ).map(([k, label, min, max]) => (
          <label key={k} className="flex items-center gap-1.5 text-sm font-semibold">
            {label}
            <select
              className="input !min-h-[36px] !w-auto !py-1"
              value={seating[k]}
              onChange={(e) => {
                const next = { ...seating, [k]: Number(e.target.value) };
                next.seats = Object.fromEntries(
                  Object.entries(seating.seats).filter(([s]) => {
                    const [r, d, n] = s.split("-").map(Number);
                    return r! <= next.rows && d! <= next.desks && n! <= next.seatsPerDesk;
                  }),
                );
                update(next);
              }}
            >
              {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => autoArrange("group")}>
          Xếp theo tổ
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => autoArrange("random")}>
          Xếp ngẫu nhiên
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ ...seating, seats: {} })}>
          Xoá hết chỗ ngồi
        </button>
        <span role="status" className="ml-auto self-center text-sm font-semibold text-ink-soft">
          {saving === "saving" ? "Đang lưu…" : saving === "saved" ? "✓ Đã lưu sơ đồ" : saving === "error" ? "Chưa lưu được" : "Tự động lưu"}
        </span>
        {saving === "error" ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => save(seating)}>
            Lưu lại
          </button>
        ) : null}
      </div>

      <div className="paper overflow-x-auto p-4">
        <div className="min-w-[640px]">
          <div className="chalkboard mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-5 py-3">
            <span className="font-display text-lg font-bold">✨ Bảng lớp {cls.name}</span>
            <span className="font-hand text-[#dff3e8]">{cls.motto}</span>
          </div>
          <div className="mx-auto mt-3 w-fit rounded-xl border-2 border-[#f3cf6b] bg-gold-soft px-6 py-2 text-center text-sm font-bold">Bàn giáo viên</div>
          <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: `repeat(${seating.rows}, minmax(0, 1fr))` }}>
            {Array.from({ length: seating.rows }, (_, r) => (
              <div key={r} className="grid content-start gap-3">
                <p className="rounded-lg bg-page py-1 text-center text-sm font-bold">Dãy {r + 1}</p>
                {Array.from({ length: seating.desks }, (_, d) => (
                  <div key={d} className="rounded-2xl border-2 border-[#f0dca0] bg-[#fffaf0] p-2">
                    <p className="mb-1 text-xs text-ink-soft">Bàn {d + 1}</p>
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${seating.seatsPerDesk}, minmax(0, 1fr))` }}>
                      {Array.from({ length: seating.seatsPerDesk }, (_, k) => {
                        const id = key(r + 1, d + 1, k + 1);
                        const s = byId.get(seating.seats[id] ?? -1);
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setPicking(id)}
                            className={cn(
                              "grid min-h-[72px] place-items-center rounded-xl border-2 px-1 py-1.5 text-center text-xs",
                              s ? cn("sticker !border-2 !shadow-none", groupClass(s.group)) : "border-dashed border-line text-ink-soft hover:border-pink",
                            )}
                            aria-label={s ? `Dãy ${r + 1}, bàn ${d + 1}: ${s.fullName}. Đổi chỗ` : `Dãy ${r + 1}, bàn ${d + 1}: chỗ trống. Xếp học sinh`}
                          >
                            {s ? (
                              <>
                                <span className="text-2xl">{s.avatarEmoji}</span>
                                <span className="font-semibold leading-tight">{firstName(s.fullName)}</span>
                                <span className="text-gold-ink">💧 {s.points}</span>
                              </>
                            ) : (
                              "＋"
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {unseated.length ? <p className="text-sm text-ink-soft">Chưa có chỗ: {unseated.map((s) => firstName(s.fullName)).join(", ")}.</p> : null}

      <Sheet open={picking !== null} onClose={() => setPicking(null)} title={pickingStudent ? `Chỗ của ${pickingStudent.fullName}` : "Xếp học sinh vào chỗ này"}>
        <div className="grid gap-3">
          {pickingStudent ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const seats = { ...seating.seats };
                delete seats[picking!];
                update({ ...seating, seats });
                setPicking(null);
              }}
            >
              Để trống chỗ này
            </button>
          ) : null}
          <p className="text-sm text-ink-soft">Chọn một bạn. Nếu bạn đó đang ngồi chỗ khác, hai bạn sẽ đổi chỗ cho nhau.</p>
          <div className="flex flex-wrap gap-1.5">
            {overview.students.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip"
                aria-pressed={seating.seats[picking ?? ""] === s.id}
                onClick={() => {
                  const seats = { ...seating.seats };
                  const from = Object.keys(seats).find((k) => seats[k] === s.id);
                  const here = seats[picking!];
                  if (from) {
                    if (here) seats[from] = here;
                    else delete seats[from];
                  }
                  seats[picking!] = s.id;
                  update({ ...seating, seats });
                  setPicking(null);
                }}
              >
                {s.avatarEmoji} {s.fullName}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </section>
  );
}
