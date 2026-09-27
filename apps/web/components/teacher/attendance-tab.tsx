"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import {
  ATTENDANCE_INFO,
  ATTENDANCE_STATUSES,
  addDays,
  type AttendanceCount,
  type AttendanceMark,
  type AttendanceStatus,
  type AttendanceView,
  type ClassOverview,
  type PeriodKind,
  type StudentRow,
} from "@lhhp/shared";
import { Avatar, Confirm, Empty, Field, Loading, LoadError, Sheet, toast } from "@/components/ui";
import { put } from "@/lib/api";
import { firstName, formatLocalDate, todayLocal } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn, groupClass } from "@/lib/utils";

const PERIODS: [PeriodKind, string][] = [
  ["week", "Tuần"],
  ["month", "Tháng"],
  ["semester", "Học kỳ"],
  ["year", "Năm học"],
];

/** Which field of a child's counts each status is totalled in. */
const COUNT_FIELD: Record<AttendanceStatus, "coMat" | "diMuon" | "coPhep" | "khongPhep"> = {
  co_mat: "coMat",
  di_muon: "diMuon",
  co_phep: "coPhep",
  khong_phep: "khongPhep",
};

const NOTE_MAX = 120;

/** "Đánh dấu Nguyễn Văn An có mặt" — the child and the action, for a screen reader. */
const actionLabel = (fullName: string, status: AttendanceStatus) =>
  `Đánh dấu ${fullName} ${ATTENDANCE_INFO[status].label.toLocaleLowerCase("vi")}`;

/** Replaces (or removes) one child's mark in a view already on screen. */
function withMark(view: AttendanceView, studentId: number, mark: AttendanceMark | null): AttendanceView {
  const marks = view.marks.filter((m) => m.studentId !== studentId);
  return { ...view, marks: mark ? [...marks, mark] : marks };
}

/**
 * Theo dõi chuyên cần: the day's register, taken one tap at a time, and how the class has attended over a week,
 * a month, a semester or the school year.
 */
export function AttendanceTab({ overview, reload }: { overview: ClassOverview; reload(): void }) {
  const classId = overview.class.id;
  const students = overview.students;
  const today = todayLocal();
  const [day, setDay] = useState(() => todayLocal());
  const [period, setPeriod] = useState<PeriodKind>("week");
  const [noteFor, setNoteFor] = useState<{ student: StudentRow; status: AttendanceStatus; text: string } | null>(null);
  const [askAllPresent, setAskAllPresent] = useState(false);
  const [saving, setSaving] = useState(0);
  // Brief 13: "chế độ chọn cá nhân hoặc chọn nhiều". One child at a time (the four buttons on each card), or several
  // picked by tapping and marked together from the bar at the bottom.
  const [mode, setMode] = useState<"one" | "many">("one");
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [manyNote, setManyNote] = useState("");
  // Two quick taps: only the newest answer may redraw the register, or the older one puts itself back on screen.
  const saveSeq = useRef(0);

  const query = new URLSearchParams({ day, period, date: day }).toString();
  const view = useApi<AttendanceView>(`/api/t/classes/${classId}/attendance?${query}`);
  const { data, setData } = view;

  const marks = useMemo(() => new Map((data?.marks ?? []).map((m) => [m.studentId, m])), [data]);
  const unmarked = students.filter((s) => !marks.has(s.id));
  const absentCount = students.filter((s) => {
    const m = marks.get(s.id);
    return m ? !ATTENDANCE_INFO[m.status].drop : false;
  }).length;
  /** Drops this day's register has handed out, so she can see the rule working. */
  const dropsToday = [...marks.values()].filter((m) => ATTENDANCE_INFO[m.status].drop).length;

  // Most absences first: the teacher opens this to see who needs looking after.
  const ranked = useMemo(() => {
    const rows = [...(data?.counts ?? [])];
    rows.sort(
      (a, b) =>
        b.khongPhep + b.coPhep - (a.khongPhep + a.coPhep) ||
        b.khongPhep - a.khongPhep ||
        b.diMuon - a.diMuon ||
        a.fullName.localeCompare(b.fullName, "vi"),
    );
    return rows;
  }, [data]);

  /** Sends part of the register. `rollback` puts the screen back the way it was if the server says no. */
  async function send(body: AttendanceMark[], rollback: () => void, quiet = false) {
    if (body.length === 0) return;
    const n = ++saveSeq.current;
    setSaving((x) => x + 1);
    const r = await put<AttendanceView>(`/api/t/classes/${classId}/attendance?${query}`, { day, marks: body });
    setSaving((x) => x - 1);
    if (!r.ok) {
      rollback();
      toast(r.message, "error");
      return;
    }
    const fresh = r.data;
    // Ignore an answer for a day the teacher has already left, and let a newer save have the last word.
    if (n === saveSeq.current) setData((cur) => (cur && cur.day !== fresh.day ? cur : fresh));
    // She could not tell the register was giving the drop, so it says so (brief 3, item 6).
    const given = body.filter((m) => ATTENDANCE_INFO[m.status].drop).length;
    if (!quiet && body.length > 1 && given > 0) toast(`Đã điểm danh và cộng 1 💧 cho ${given} bạn.`);
    // The register gives a drop for every child at school, so the class totals have moved.
    reload();
  }

  function mark(student: StudentRow, status: AttendanceStatus) {
    const before = marks.get(student.id) ?? null;
    if (before?.status === status) return;
    // A child who is no longer absent keeps no reason for being away.
    const note = ATTENDANCE_INFO[status].drop ? "" : (before?.note ?? "");
    setData((cur) => (cur ? withMark(cur, student.id, { studentId: student.id, status, note }) : cur));
    void send([{ studentId: student.id, status, note }], () =>
      setData((cur) => (cur ? withMark(cur, student.id, before) : cur)),
    );
  }

  function allPresent(targets: StudentRow[]) {
    const before = data?.marks ?? [];
    const body: AttendanceMark[] = targets.map((s) => ({ studentId: s.id, status: "co_mat", note: "" }));
    setData((cur) => (cur ? { ...cur, marks: [...cur.marks.filter((m) => !targets.some((s) => s.id === m.studentId)), ...body] } : cur));
    void send(body, () => setData((cur) => (cur ? { ...cur, marks: before } : cur)));
  }

  /** The bar at the bottom: every picked child gets the same mark, and the same reason if they are away. */
  function markPicked(status: AttendanceStatus) {
    const targets = students.filter((s) => picked.has(s.id));
    if (targets.length === 0) return;
    const info = ATTENDANCE_INFO[status];
    const note = info.drop ? "" : manyNote.trim().slice(0, NOTE_MAX);
    const before = data?.marks ?? [];
    const body: AttendanceMark[] = targets.map((s) => ({ studentId: s.id, status, note }));
    setData((cur) => (cur ? { ...cur, marks: [...cur.marks.filter((m) => !picked.has(m.studentId)), ...body] } : cur));
    void send(body, () => setData((cur) => (cur ? { ...cur, marks: before } : cur)), true);
    toast(`Đã điểm danh ${targets.length} bạn: ${info.label}${info.drop ? " (cộng 1 💧)" : ""}.`);
    setPicked(new Set());
    setManyNote("");
  }

  const togglePick = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function saveNote() {
    if (!noteFor) return;
    const { student, status } = noteFor;
    const before = marks.get(student.id) ?? null;
    const note = noteFor.text.trim().slice(0, NOTE_MAX);
    setNoteFor(null);
    if ((before?.note ?? "") === note) return;
    setData((cur) => (cur ? withMark(cur, student.id, { studentId: student.id, status, note }) : cur));
    void send([{ studentId: student.id, status, note }], () =>
      setData((cur) => (cur ? withMark(cur, student.id, before) : cur)),
    );
  }

  const changeDay = (next: string) => {
    if (!next) return;
    if (next > today) return toast("Chưa điểm danh cho ngày chưa tới được.", "error");
    setDay(next);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[2rem] font-extrabold">📅 Theo dõi chuyên cần</h1>
        <p className="text-ink-soft">
          Chạm một lần là lưu ngay. Bạn nào 🙋 có mặt hoặc ⏰ đi muộn được cộng 1 💧 của ngày hôm đó; nghỉ học thì
          không có.
        </p>
      </div>

      <section className="paper grid gap-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field
            label="Ngày điểm danh"
            type="date"
            value={day}
            max={today}
            onChange={(e) => changeDay(e.target.value)}
            className="min-w-[11rem]"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              className="btn btn-ghost btn-sm !min-w-[44px] !px-2"
              aria-label="Ngày hôm trước"
              onClick={() => changeDay(addDays(day, -1))}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeDay(today)}>
              Hôm nay
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm !min-w-[44px] !px-2"
              aria-label="Ngày hôm sau"
              disabled={day >= today}
              onClick={() => changeDay(addDays(day, 1))}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <p className="ml-auto self-center font-display text-lg font-bold">
            {day === today ? "Hôm nay, " : ""}
            {formatLocalDate(day)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={students.length === 0 || !data}
            onClick={() => (unmarked.length === 0 ? setAskAllPresent(true) : allPresent(unmarked))}
          >
            🙋 Cả lớp có mặt
          </button>
          <p className="text-sm text-ink-soft">
            {students.length === 0
              ? "Lớp chưa có học sinh nào."
              : unmarked.length > 0
                ? `Đánh dấu ${unmarked.length} bạn chưa điểm danh là có mặt.${absentCount > 0 ? ` Giữ nguyên ${absentCount} bạn đang nghỉ.` : ""}`
                : `Cả ${students.length} bạn đã điểm danh xong.`}
          </p>
          <span role="status" className="ml-auto text-sm font-semibold text-ink-soft">
            {saving > 0 ? "Đang lưu…" : `Đã điểm danh ${students.length - unmarked.length}/${students.length} bạn`}
          </span>
          {dropsToday > 0 ? (
            <span className="point-count w-full justify-start sm:w-auto">💧 Đã tặng {dropsToday} giọt nước chuyên cần hôm nay</span>
          ) : null}
        </div>
      </section>

      {view.error ? (
        <LoadError message={view.error} onRetry={view.reload} />
      ) : !data ? (
        <Loading label="Đang mở sổ điểm danh…" />
      ) : students.length === 0 ? (
        <Empty emoji="🧒" title="Lớp chưa có học sinh">
          <p>Thêm học sinh trong mục Học sinh rồi quay lại điểm danh nhé.</p>
        </Empty>
      ) : (
        <>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Cách điểm danh" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              role="tab"
              className="chip !min-h-[44px]"
              aria-selected={mode === "one"}
              onClick={() => {
                setMode("one");
                setPicked(new Set());
              }}
            >
              👆 Từng bạn
            </button>
            <button type="button" role="tab" className="chip !min-h-[44px]" aria-selected={mode === "many"} onClick={() => setMode("many")}>
              ☑️ Chọn nhiều bạn
            </button>
          </div>
          {mode === "many" ? (
            <>
              <p className="text-sm text-ink-soft">Chạm vào các bạn cần điểm danh, rồi chọn ở thanh cuối trang.</p>
              <span className="ml-auto flex gap-1.5">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set(students.map((s) => s.id)))}>
                  Chọn cả lớp
                </button>
                {picked.size > 0 ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set())}>
                    Bỏ chọn
                  </button>
                ) : null}
              </span>
            </>
          ) : null}
        </div>
        <ul className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", view.loading && "opacity-60", picked.size > 0 && "pb-56 sm:pb-40")}>
          {students.map((s) => {
            const m = marks.get(s.id) ?? null;
            const away = m ? !ATTENDANCE_INFO[m.status].drop : false;
            if (mode === "many") {
              const on = picked.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`Chọn ${s.fullName}`}
                    onClick={() => togglePick(s.id)}
                    className={cn(
                      "sticker flex w-full items-center gap-2 p-3 text-left",
                      groupClass(s.group),
                      on && "!border-pink-ink ring-4 ring-pink-ink/40",
                    )}
                  >
                    <span
                      className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold", on ? "border-pink-ink bg-pink-ink text-white" : "border-line bg-white")}
                      aria-hidden
                    >
                      {on ? "✓" : ""}
                    </span>
                    <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold leading-tight" title={s.fullName}>
                        {firstName(s.fullName)}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {s.group ? `Tổ ${s.group}` : "Chưa có tổ"}
                        {m ? ` · ${ATTENDANCE_INFO[m.status].label}` : " · Chưa điểm danh"}
                      </span>
                    </span>
                    <span className="text-xl" aria-hidden>
                      {m ? ATTENDANCE_INFO[m.status].emoji : ""}
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li key={s.id} className={cn("sticker p-3", groupClass(s.group))} data-selected={m !== null}>
                <div className="flex items-center gap-2">
                  <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold leading-tight" title={s.fullName}>
                      {firstName(s.fullName)}
                    </span>
                    <span className="block text-xs text-ink-soft">{s.group ? `Tổ ${s.group}` : "Chưa có tổ"}</span>
                  </span>
                  <span className="text-xl" aria-hidden>
                    {m ? ATTENDANCE_INFO[m.status].emoji : ""}
                  </span>
                </div>
                <div role="group" aria-label={`Điểm danh ${s.fullName}`} className="mt-2 grid grid-cols-4 gap-1">
                  {ATTENDANCE_STATUSES.map((st) => {
                    const info = ATTENDANCE_INFO[st];
                    const on = m?.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        aria-pressed={on}
                        aria-label={actionLabel(s.fullName, st)}
                        title={info.label}
                        onClick={() => mark(s, st)}
                        className={cn(
                          "grid min-h-[48px] place-items-center gap-0.5 rounded-xl border-2 px-0.5 py-1 text-center text-[0.68rem] font-semibold leading-tight",
                          on ? "border-pink-ink bg-pink-ink text-white" : "border-line bg-page text-ink",
                        )}
                      >
                        <span className="text-base" aria-hidden>
                          {info.emoji}
                        </span>
                        <span aria-hidden>{info.short}</span>
                      </button>
                    );
                  })}
                </div>
                {away && m ? (
                  <button
                    type="button"
                    onClick={() => setNoteFor({ student: s, status: m.status, text: m.note })}
                    aria-label={`${m.note ? "Sửa" : "Thêm"} lý do nghỉ của ${s.fullName}`}
                    className="mt-2 flex min-h-[44px] w-full items-center gap-1.5 rounded-xl bg-page px-2.5 py-1.5 text-left text-sm"
                  >
                    <Pencil size={14} className="shrink-0" aria-hidden />
                    <span className={cn("truncate", !m.note && "text-ink-soft")}>{m.note || "Thêm lý do nghỉ…"}</span>
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        </>
      )}

      {/* "Cuối trang có phần điểm danh những HS đã chọn theo tiêu chí" (brief 13). Fixed to the bottom of the screen, so
          it is there however far down the class she has scrolled. */}
      {mode === "many" && picked.size > 0 ? (
        <section
          aria-label="Điểm danh các bạn đã chọn"
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-pink-ink bg-white/97 px-3 py-3 shadow-[0_-8px_24px_rgba(59,42,74,0.15)] backdrop-blur sm:px-6"
        >
          <div className="mx-auto grid max-w-[1400px] gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-extrabold">Đã chọn {picked.size} bạn</p>
              <p className="text-sm text-ink-soft">— điểm danh là:</p>
              <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setPicked(new Set())}>
                Bỏ chọn
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ATTENDANCE_STATUSES.map((st) => (
                <button key={st} type="button" className={cn("btn !min-h-[48px]", ATTENDANCE_INFO[st].drop ? "btn-primary" : "btn-ghost")} onClick={() => markPicked(st)}>
                  <span aria-hidden>{ATTENDANCE_INFO[st].emoji}</span> {ATTENDANCE_INFO[st].label}
                </button>
              ))}
            </div>
            <Field
              label="Lý do (không bắt buộc)"
              value={manyNote}
              maxLength={NOTE_MAX}
              placeholder="Ví dụ: Con bị sốt — ghi cho các bạn nghỉ"
              onChange={(e) => setManyNote(e.target.value)}
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-xl font-extrabold">Bảng chuyên cần</h2>
          <div role="tablist" aria-label="Khoảng thời gian" className="flex flex-wrap gap-1.5">
            {PERIODS.map(([k, label]) => (
              <button key={k} type="button" role="tab" className="chip" aria-selected={period === k} onClick={() => setPeriod(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {data ? (
          data.daysTaken === 0 ? (
            <Empty emoji="📅" title="Sổ điểm danh còn trống">
              <p>
                {data.period.label}: chưa có buổi nào được điểm danh. Cô điểm danh ở phần trên, bảng này sẽ tự có số
                liệu.
              </p>
            </Empty>
          ) : (
            <div className={cn("paper grid gap-3 p-4", view.loading && "opacity-60")}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-display text-lg font-bold">{data.period.label}</p>
                <p className="text-sm text-ink-soft">
                  Đã điểm danh {data.daysTaken} buổi ({formatLocalDate(data.period.startDate)} –{" "}
                  {formatLocalDate(data.period.endDate)})
                </p>
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                {ATTENDANCE_STATUSES.map((st) => (
                  <span key={st}>
                    <span aria-hidden>{ATTENDANCE_INFO[st].emoji}</span> {ATTENDANCE_INFO[st].label}
                  </span>
                ))}
              </p>
              <ul className="grid" style={{ fontVariantNumeric: "tabular-nums" }}>
                {ranked.map((c) => (
                  <li key={c.studentId} className="flex flex-wrap items-center gap-2 rounded-xl px-1 py-1.5 odd:bg-page">
                    <Avatar emoji={c.avatarEmoji} url={c.avatarUrl} name={c.fullName} size={34} />
                    <span className="min-w-[8rem] flex-1 truncate">
                      <span className="font-semibold">{c.fullName}</span>
                      {c.group ? <span className="ml-1.5 text-xs text-ink-soft">Tổ {c.group}</span> : null}
                    </span>
                    <dl className="flex shrink-0 gap-1">
                      {ATTENDANCE_STATUSES.map((st) => (
                        <CountBox key={st} count={c} status={st} />
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink-soft">Xếp bạn nghỉ nhiều nhất lên đầu, để cô hỏi thăm gia đình con.</p>
            </div>
          )
        ) : null}
      </section>

      <Sheet
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title={noteFor ? `Lý do nghỉ của ${noteFor.student.fullName}` : ""}
        footer={
          <button type="button" className="btn btn-primary" onClick={saveNote}>
            Lưu lý do
          </button>
        }
      >
        {noteFor ? (
          <div className="grid gap-3">
            <p className="text-ink-soft">
              {ATTENDANCE_INFO[noteFor.status].emoji} {ATTENDANCE_INFO[noteFor.status].label}, ngày{" "}
              {formatLocalDate(day)}. Gia đình và con đều đọc được ghi chú này.
            </p>
            <Field
              label="Ghi chú ngắn"
              data-autofocus
              value={noteFor.text}
              maxLength={NOTE_MAX}
              placeholder="Ví dụ: Con bị sốt"
              hint={`Tối đa ${NOTE_MAX} ký tự, còn ${NOTE_MAX - noteFor.text.length}.`}
              onChange={(e) => setNoteFor({ ...noteFor, text: e.target.value.slice(0, NOTE_MAX) })}
            />
            {noteFor.text ? (
              <button type="button" className="btn btn-ghost justify-self-start" onClick={() => setNoteFor({ ...noteFor, text: "" })}>
                Xoá lý do
              </button>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      {/* Filling in the children nobody has marked yet never overwrites anything, so it just happens. Asking again
          when the register is already complete is the one case where the tap would wipe a mark the teacher made. */}
      <Confirm
        open={askAllPresent}
        title="Đánh dấu lại cả lớp?"
        body={
          <p>
            Cả lớp đã điểm danh xong cho ngày {formatLocalDate(day)}.
            {absentCount > 0 ? (
              <>
                {" "}
                Đánh dấu tất cả {students.length} bạn có mặt sẽ ghi đè <strong>{absentCount} bạn đang nghỉ</strong> cùng
                lý do nghỉ của con.
              </>
            ) : (
              <> Tất cả {students.length} bạn sẽ được đánh dấu có mặt lại.</>
            )}
          </p>
        }
        action="Đánh dấu cả lớp có mặt"
        onClose={() => setAskAllPresent(false)}
        onConfirm={() => {
          allPresent(students);
          setAskAllPresent(false);
        }}
      />
    </div>
  );
}

function CountBox({ count, status }: { count: AttendanceCount; status: AttendanceStatus }) {
  const info = ATTENDANCE_INFO[status];
  const n = count[COUNT_FIELD[status]];
  return (
    <div
      className={cn(
        "grid w-9 place-items-center rounded-lg bg-paper py-1 text-center leading-none",
        n === 0 && "opacity-45",
        status === "khong_phep" && n > 0 && "text-red-pen",
      )}
      title={`${info.label}: ${n}`}
    >
      <dt className="text-xs">
        <span aria-hidden>{info.emoji}</span>
        <span className="sr-only">{info.label}</span>
      </dt>
      <dd className="mt-0.5 text-sm font-bold">{n}</dd>
    </div>
  );
}
