"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { POINT_CATEGORY_INFO, addDays, type ReportData } from "@lhhp/shared";
import { DivergingColumns, HBars } from "@/components/charts";
import { Loading, LoadError } from "@/components/ui";
import { todayLocal } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type Kind = "week" | "month" | "semester";

function shiftMonth(date: string, by: number): string {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * The week / month / semester switcher and the charts every report shares. `children` renders what's specific to
 * the class or the child, from the same data.
 */
export function ReportView<T extends ReportData>({
  base,
  children,
  compact,
}: {
  base: string;
  children?: (data: T) => ReactNode;
  compact?: boolean;
}) {
  const [kind, setKind] = useState<Kind>("week");
  const [date, setDate] = useState(todayLocal());
  const [semester, setSemester] = useState<"1" | "2" | "">("");
  const q = new URLSearchParams({ period: kind, date });
  if (kind === "semester" && semester) q.set("semester", semester);
  const { data, error, loading, reload } = useApi<T>(`${base}?${q}`);

  const step = (dir: 1 | -1) => setDate((d) => (kind === "week" ? addDays(d, 7 * dir) : shiftMonth(d, dir)));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Khoảng thời gian" className="flex gap-1.5">
          {(
            [
              ["week", "Tuần"],
              ["month", "Tháng"],
              ["semester", "Học kỳ"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" className="chip" aria-selected={kind === k} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
        {kind === "semester" ? (
          <label className="flex items-center gap-2">
            <span className="sr-only">Chọn học kỳ</span>
            <select className="input !min-h-[36px] !w-auto !py-1" value={semester} onChange={(e) => setSemester(e.target.value as "1" | "2" | "")}>
              <option value="">Học kỳ hiện tại</option>
              <option value="1">Học kỳ I</option>
              <option value="2">Học kỳ II</option>
            </select>
          </label>
        ) : (
          <span className="flex items-center gap-1">
            <button type="button" className="btn btn-ghost btn-sm !min-w-[44px] !px-2" onClick={() => step(-1)} aria-label={kind === "week" ? "Tuần trước" : "Tháng trước"}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate(todayLocal())}>
              {kind === "week" ? "Tuần này" : "Tháng này"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm !min-w-[44px] !px-2" onClick={() => step(1)} aria-label={kind === "week" ? "Tuần sau" : "Tháng sau"}>
              <ChevronRight size={18} />
            </button>
          </span>
        )}
        {data ? <span className="ml-auto font-display text-xl font-bold">{data.period.label}</span> : null}
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className={cn("grid gap-5 transition-opacity", loading && "opacity-60")}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Giọt nước được cộng" value={`+${data.totals.plus}`} />
            <Tile label="Giọt nước bị trừ" value={data.totals.minus ? `−${data.totals.minus}` : "0"} />
            <Tile label="Tổng cộng" value={String(data.totals.net)} />
            <Tile label="Lần yêu thương" value={String(data.totals.kindness)} />
          </ul>
          <section className="paper p-4">
            <DivergingColumns data={data.buckets} title={kind === "week" ? "Giọt nước theo từng ngày" : kind === "month" ? "Giọt nước theo từng tuần" : "Giọt nước theo từng tháng"} />
          </section>
          <div className={cn("grid gap-5", !compact && "lg:grid-cols-2")}>
            <section className="paper p-4">
              <HBars
                title="Giọt nước theo nhóm lý do"
                empty="Chưa có giọt nước nào được cộng."
                rows={data.categories.map((c) => ({ label: POINT_CATEGORY_INFO[c.category].label, emoji: POINT_CATEGORY_INFO[c.category].emoji, value: c.plus }))}
              />
            </section>
            <section className="paper p-4">
              <HBars
                title="Lý do nhiều nhất (số lần)"
                empty="Chưa có lượt chấm điểm nào."
                rows={data.reasons.map((r) => ({ label: `${r.kind === "minus" ? "(trừ) " : ""}${r.reason}`, emoji: r.emoji, value: r.count }))}
              />
            </section>
          </div>
          <section className="paper p-4">
            <h3 className="font-display text-lg font-bold">Nhiệm vụ giao trong thời gian này</h3>
            {/* One number, not one per subject: "K cần hiển thị các phân môn" (brief 9). */}
            {(() => {
              const assigned = data.subjects.reduce((n, s) => n + s.assigned, 0);
              return assigned === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">Chưa giao nhiệm vụ nào.</p>
              ) : (
                <p className="mt-2">
                  Đã giao <strong>{assigned}</strong> nhiệm vụ.
                </p>
              );
            })()}
          </section>
          {children ? children(data) : null}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <li className="paper px-4 py-3">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="text-[1.6rem] font-semibold leading-tight">{value}</p>
    </li>
  );
}
