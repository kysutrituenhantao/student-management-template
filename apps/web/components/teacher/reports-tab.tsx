"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { ClassOverview, ClassReport } from "@lhhp/shared";
import { ReportView } from "@/components/report-view";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

type SortKey = "list" | "net" | "plus" | "minus";

function csvCell(v: string | number | null): string {
  if (v === null) return "";
  let s = String(v);
  // Text that Excel would run as a formula is neutralised; numbers, including negative totals, stay numbers.
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(report: ClassReport, className: string) {
  const header = ["STT", "Họ và tên", "Tổ", "Giọt nước cộng", "Giọt nước trừ", "Tổng"];
  const rows = report.students.map((s, i) => [i + 1, s.fullName, s.group, s.plus, s.minus, s.net]);
  // A BOM so Excel opens the Vietnamese text as UTF-8.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `bao-cao-${className.replace(/\s+/g, "-")}-${report.period.startDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsTab({ overview }: { overview: ClassOverview }) {
  const [sort, setSort] = useState<SortKey>("list");
  return (
    <div className="grid gap-5">
      <h1 className="text-[2rem] font-extrabold">📊 Báo cáo</h1>
      <ReportView<ClassReport> base={`/api/t/classes/${overview.class.id}/report`}>
        {(report) => {
          const rows = [...report.students];
          if (sort !== "list") rows.sort((a, b) => ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number));
          const th = (key: SortKey, label: string) => (
            <th className="px-2 py-2 text-right font-semibold">
              <button type="button" className={cn("underline-offset-4", sort === key && "text-pink-ink underline")} onClick={() => setSort(key)}>
                {label}
              </button>
            </th>
          );
          return (
            <section className="paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto font-display text-lg font-bold">Từng học sinh</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv(report, overview.class.name)}>
                  <Download size={16} /> Tải file Excel (CSV)
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                  In báo cáo
                </button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-[0.95rem]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <thead className="text-sm text-ink-soft">
                    <tr>
                      <th className="py-2 pr-2 text-left font-semibold">
                        <button type="button" className={cn(sort === "list" && "text-pink-ink underline")} onClick={() => setSort("list")}>
                          Học sinh
                        </button>
                      </th>
                      {th("plus", "Giọt nước cộng")}
                      {th("minus", "Giọt nước trừ")}
                      {th("net", "Tổng")}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-2">
                            <Avatar emoji={s.avatarEmoji} url={null} name={s.fullName} size={28} />
                            {s.fullName}
                          </span>
                        </td>
                        <td className="px-2 text-right">+{s.plus}</td>
                        <td className="px-2 text-right">{s.minus ? `−${s.minus}` : 0}</td>
                        <td className="px-2 text-right font-bold">{s.net}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }}
      </ReportView>
    </div>
  );
}
