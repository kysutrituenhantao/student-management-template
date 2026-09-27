"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  HONOUR_INFO,
  MAX_COMPETITION_ROWS,
  lastSchoolWeek,
  type ClassOverview,
  type CompetitionEntry,
  type CompetitionPeriod,
  type SchoolRanking,
} from "@lhhp/shared";
import { CompetitionChart } from "@/components/competition-chart";
import { SchoolWeekSelect, WeekMonthPicker } from "@/components/period-picker";
import { Confirm, Empty, FormError, Loading, LoadError, Sheet, toast } from "@/components/ui";
import { api, del } from "@/lib/api";
import { todayLocal } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/**
 * Kết quả thi đua (brief 12): "GV có thể thêm kết quả thi đua của các lớp trong trường, xếp loại điểm từ cao đến
 * thấp theo biểu đồ hình cột (riêng lớp 4C luôn là cột màu đỏ…)". She types each class's score for a week or a
 * month; the families see the same chart under Thi đua.
 */
export function CompetitionTab({ overview }: { overview: ClassOverview }) {
  const classId = overview.class.id;
  const sem = overview.class.semesters;
  const [kind, setKind] = useState<CompetitionPeriod>("week");
  // Brief 18: "hiển thị kết qủa tuần trước" — it opens on the latest school week that has finished.
  const [weekDate, setWeekDate] = useState(() => lastSchoolWeek(sem, todayLocal())?.monday ?? todayLocal());
  const [monthDate, setMonthDate] = useState(todayLocal());
  const date = kind === "week" ? weekDate : monthDate;
  const url = `/api/t/classes/${classId}/competition?period=${kind}&date=${date}`;
  const { data, setData, error, reload, loading } = useApi<SchoolRanking>(url);
  const entered = useApi<CompetitionEntry[]>(`/api/t/classes/${classId}/competition/entered`);
  const enteredWeeks = new Set((entered.data ?? []).filter((e) => e.period === "week").map((e) => e.periodKey));
  const [editing, setEditing] = useState(false);
  const [clearing, setClearing] = useState(false);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[2rem] font-extrabold">📊 Kết quả thi đua</h1>
        <p className="text-ink-soft">
          Kết quả thi đua của các lớp trong trường theo tuần, theo tháng. Lớp mình luôn là cột màu đỏ. Phụ huynh và các con
          xem được ở mục Thi đua.
        </p>
      </div>
      {kind === "week" ? (
        <div className="grid gap-2">
          <KindTabs kind={kind} onKind={setKind} />
          <SchoolWeekSelect sem={sem} value={weekDate} onChange={setWeekDate} entered={enteredWeeks} />
        </div>
      ) : (
        <WeekMonthPicker kind={kind} onKind={setKind} date={monthDate} onDate={setMonthDate} label={data?.periodLabel} />
      )}

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.rows.length === 0 ? (
        <Empty emoji="📊" title={`Chưa có kết quả ${kind === "week" ? "tuần" : "tháng"} này`}>
          <p>Khi trường gửi kết quả thi đua, cô nhập điểm của các lớp vào đây.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => setEditing(true)}>
            <Plus size={18} /> Nhập kết quả
          </button>
        </Empty>
      ) : (
        <section className={cn("paper grid gap-4 p-4 transition-opacity", loading && "opacity-60")}>
          <CompetitionChart ranking={data} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              <Pencil size={16} /> Nhập kết quả
            </button>
            <button type="button" className="btn btn-ghost text-red-pen" onClick={() => setClearing(true)}>
              <Trash2 size={16} /> Xoá kết quả {kind === "week" ? "tuần" : "tháng"} này
            </button>
          </div>
        </section>
      )}

      {editing && data ? (
        <ResultsSheet
          ranking={data}
          ourName={overview.class.name}
          onClose={() => setEditing(false)}
          onSave={async (rows) => {
            const r = await api<SchoolRanking>(`/api/t/classes/${classId}/competition`, { method: "PUT", body: { period: kind, date, rows } });
            if (!r.ok) return r.message;
            setData(r.data);
            void entered.reload();
            setEditing(false);
            toast("Đã lưu kết quả thi đua.");
            return null;
          }}
        />
      ) : null}
      <Confirm
        open={clearing}
        title="Xoá kết quả này?"
        danger
        body={<p>Xoá kết quả thi đua {data?.periodLabel}. Phụ huynh sẽ không còn thấy biểu đồ của kỳ này.</p>}
        action="Xoá"
        onClose={() => setClearing(false)}
        onConfirm={async () => {
          setClearing(false);
          const r = await del(`/api/t/classes/${classId}/competition?period=${kind}&date=${date}`);
          if (!r.ok) return toast(r.message, "error");
          void reload();
          void entered.reload();
        }}
      />
    </div>
  );
}

/** Tuần / Tháng, the same chips the month picker shows. */
function KindTabs({ kind, onKind }: { kind: CompetitionPeriod; onKind(k: CompetitionPeriod): void }) {
  return (
    <div role="tablist" aria-label="Theo tuần hay tháng" className="flex flex-wrap gap-1.5">
      {(["week", "month"] as const).map((k) => (
        <button key={k} type="button" role="tab" aria-selected={kind === k} className="chip !min-h-[44px]" onClick={() => onKind(k)}>
          <span aria-hidden>{HONOUR_INFO[k].emoji}</span> {HONOUR_INFO[k].label}
        </button>
      ))}
    </div>
  );
}

interface Row {
  name: string;
  score: string;
  isOurs: boolean;
}

/** "97,5" as a Vietnamese keyboard types it, or "97.5". */
const readScore = (s: string) => Number(s.trim().replace(",", "."));

function ResultsSheet({
  ranking,
  ourName,
  onClose,
  onSave,
}: {
  ranking: SchoolRanking;
  ourName: string;
  onClose(): void;
  onSave(rows: { name: string; score: number; isOurs: boolean }[]): Promise<string | null>;
}) {
  // What she entered before, or last time's classes with the scores left for her, or just her own class.
  const [rows, setRows] = useState<Row[]>(() =>
    ranking.rows.length
      ? ranking.rows.map((r) => ({ name: r.name, score: String(r.score).replace(".", ","), isOurs: r.isOurs }))
      : ranking.lastNames?.length
        ? ranking.lastNames.map((r) => ({ ...r, score: "" }))
        : [{ name: ourName, score: "", isOurs: true }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setError(null);
    const bad = rows.findIndex((r) => !r.name.trim() || r.score.trim() === "" || !Number.isFinite(readScore(r.score)));
    if (bad >= 0) return setError(`Dòng ${bad + 1}: cần có tên lớp và điểm.`);
    setBusy(true);
    const msg = await onSave(rows.map((r) => ({ name: r.name.trim(), score: readScore(r.score), isOurs: r.isOurs })));
    setBusy(false);
    if (msg) setError(msg);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Kết quả thi đua ${ranking.periodLabel}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Thôi
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <p className="text-sm text-ink-soft">Mỗi dòng một lớp: tên lớp và điểm thi đua. Thứ tự không quan trọng, biểu đồ tự xếp từ cao đến thấp.</p>
        <div className="grid grid-cols-[1fr_6.5rem_2.75rem] gap-2 text-sm font-semibold text-ink-soft" aria-hidden>
          <span>Tên lớp</span>
          <span>Điểm</span>
          <span />
        </div>
        <ol className="grid gap-2">
          {rows.map((r, i) => (
            <li key={i} className={cn("grid grid-cols-[1fr_6.5rem_2.75rem] items-center gap-2", r.isOurs && "rounded-xl bg-pink-soft p-1.5")}>
              <span className="grid gap-0.5">
                <input
                  className="input"
                  aria-label={`Tên lớp ${i + 1}`}
                  value={r.name}
                  maxLength={40}
                  onChange={(e) => set(i, { name: e.target.value })}
                  placeholder="Ví dụ: Lớp 4A"
                />
                {r.isOurs ? <span className="text-xs font-bold text-red-pen">● Lớp của cô — cột màu đỏ</span> : null}
              </span>
              <input
                className="input text-right tabular-nums"
                aria-label={`Điểm ${i + 1}`}
                inputMode="decimal"
                value={r.score}
                onChange={(e) => set(i, { score: e.target.value })}
                placeholder="0"
              />
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full text-red-pen hover:bg-pink-soft disabled:opacity-30"
                aria-label={`Bỏ dòng ${i + 1}`}
                disabled={r.isOurs}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn btn-ghost justify-self-start"
          disabled={rows.length >= MAX_COMPETITION_ROWS}
          onClick={() => setRows((rs) => [...rs, { name: "", score: "", isOurs: false }])}
        >
          <Plus size={16} /> Thêm lớp
        </button>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
