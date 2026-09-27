"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PointEvent, Reason } from "@lhhp/shared";
import { Loading, LoadError, Sheet, toast } from "@/components/ui";
import { api, del, patch } from "@/lib/api";
import { signed, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "Lịch sử": every award, newest first. Name a reason for quick taps, or remove a mistake. */
export function HistorySheet({
  open,
  onClose,
  classId,
  reasons,
  studentId,
  onChanged,
}: {
  open: boolean;
  onClose(): void;
  classId: number;
  reasons: Reason[];
  studentId?: number;
  onChanged(): void;
}) {
  const [items, setItems] = useState<PointEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(
    async (before?: number) => {
      const q = new URLSearchParams({ limit: "50" });
      if (studentId) q.set("studentId", String(studentId));
      if (before) q.set("before", String(before));
      setLoadError(null);
      const r = await api<PointEvent[]>(`/api/t/classes/${classId}/points?${q}`);
      if (!r.ok) {
        if (before) return toast(r.message, "error");
        return setLoadError(r.message);
      }
      setItems((xs) => (before ? [...(xs ?? []), ...r.data] : r.data));
      setMore(r.data.length === 50);
    },
    [classId, studentId],
  );

  useEffect(() => {
    if (open) {
      setItems(null);
      void load();
    }
  }, [open, load]);

  return (
    <Sheet open={open} onClose={onClose} title="📜 Lịch sử chấm điểm" wide>
      {loadError ? (
        <LoadError message={loadError} onRetry={() => load()} />
      ) : !items ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">Chưa có lượt chấm điểm nào.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className={cn("w-12 text-right font-display text-xl font-extrabold", e.delta > 0 ? "text-gold-ink" : "text-red-pen")}>
                {signed(e.delta)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.studentName}</p>
                <p className="text-sm text-ink-soft">
                  {e.emoji} {e.reason} <span className="whitespace-nowrap">({timeAgo(e.createdAt)})</span>
                </p>
              </div>
              {editing === e.id ? (
                <select
                  className="input !w-auto !min-h-[36px] !py-1 text-sm"
                  autoFocus
                  defaultValue=""
                  onBlur={() => setEditing(null)}
                  onChange={async (ev) => {
                    const r = await patch<PointEvent>(`/api/t/points/${e.id}`, { reasonId: Number(ev.target.value) });
                    setEditing(null);
                    if (!r.ok) return toast(r.message, "error");
                    setItems((xs) => xs!.map((x) => (x.id === e.id ? r.data : x)));
                    onChanged();
                  }}
                >
                  <option value="" disabled>
                    Chọn lý do…
                  </option>
                  {reasons
                    .filter((r) => (r.kind === "plus") === e.delta > 0)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.emoji} {r.label}
                      </option>
                    ))}
                </select>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(e.id)}>
                  {e.category === "chung" ? "Thêm lý do" : "Đổi lý do"}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm !px-2 text-red-pen"
                aria-label={`Xoá lượt ${signed(e.delta)} của ${e.studentName}`}
                onClick={async () => {
                  const r = await del(`/api/t/points/${e.id}`);
                  if (!r.ok) return toast(r.message, "error");
                  setItems((xs) => xs!.filter((x) => x.id !== e.id));
                  onChanged();
                }}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {more ? (
        <div className="mt-3 text-center">
          <button type="button" className="btn btn-ghost" onClick={() => load(items![items!.length - 1]!.id)}>
            Xem thêm
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
