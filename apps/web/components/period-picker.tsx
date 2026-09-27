"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { HONOUR_INFO, addDays, schoolWeeks, type CompetitionPeriod, type Semesters } from "@lhhp/shared";
import { todayLocal } from "@/lib/format";

/** The first day of the month `by` months away from the one `date` is in. */
export function shiftMonth(date: string, by: number): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + by, 1)).toISOString().slice(0, 10);
}

/** Tuần / Tháng, and back and forth between them: the same control on her side and the family's. */
export function WeekMonthPicker({
  kind,
  onKind,
  date,
  onDate,
  label,
  weekOnly = false,
}: {
  kind: CompetitionPeriod;
  onKind(k: CompetitionPeriod): void;
  date: string;
  onDate(d: string): void;
  /** "Tuần 3 (21/09 – 27/09)", as the API names the period. */
  label?: string;
  /** Only weeks, back and forth: the family's Vinh danh (brief 15, "hiển thị theo tuần"). */
  weekOnly?: boolean;
}) {
  const step = (by: number) => onDate(kind === "week" ? addDays(date, 7 * by) : shiftMonth(date, by));
  const word = kind === "week" ? "Tuần" : "Tháng";
  return (
    <div className="grid gap-2">
      {weekOnly ? null : (
        <div role="tablist" aria-label="Theo tuần hay tháng" className="flex flex-wrap gap-1.5">
          {(["week", "month"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className="chip !min-h-[44px]" onClick={() => onKind(k)}>
              <span aria-hidden>{HONOUR_INFO[k].emoji}</span> {HONOUR_INFO[k].label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px] !px-2" onClick={() => step(-1)} aria-label={`${word} trước`}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="btn btn-ghost btn-sm !min-h-[44px]" onClick={() => onDate(todayLocal())}>
          {word} này
        </button>
        <button type="button" className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px] !px-2" onClick={() => step(1)} aria-label={`${word} sau`}>
          <ChevronRight size={18} />
        </button>
        {label ? <span className="ml-1 font-display text-lg font-bold">{label}</span> : null}
      </div>
    </div>
  );
}

/**
 * Her school weeks by name, "Tuần 1 (07/09 – 11/09)" to "Tuần 35" (brief 18), with the ones she has entered ticked,
 * and ‹ › to step through them. `value` is the week's Monday.
 */
export function SchoolWeekSelect({
  sem,
  value,
  onChange,
  entered,
}: {
  sem: Semesters;
  value: string;
  onChange(monday: string): void;
  /** Mondays of the weeks that have results. */
  entered: Set<string>;
}) {
  const weeks = schoolWeeks(sem);
  const i = weeks.findIndex((w) => w.monday === value);
  const step = (by: number) => {
    const next = weeks[Math.min(weeks.length - 1, Math.max(0, (i < 0 ? 0 : i) + by))];
    if (next) onChange(next.monday);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px] !px-2" onClick={() => step(-1)} disabled={i <= 0} aria-label="Tuần trước">
        <ChevronLeft size={18} />
      </button>
      <select className="input !w-auto min-w-[15rem] font-semibold" aria-label="Chọn tuần" value={value} onChange={(e) => onChange(e.target.value)}>
        {weeks.map((w) => (
          <option key={w.n} value={w.monday}>
            {w.label}
            {entered.has(w.monday) ? " ✓" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px] !px-2"
        onClick={() => step(1)}
        disabled={i >= weeks.length - 1}
        aria-label="Tuần sau"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
