"use client";

import type { LeaderRow } from "@lhhp/shared";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ rows, title = "🏆 Top 10 tuần này" }: { rows: LeaderRow[]; title?: string }) {
  return (
    <section className="sticker group-3 p-4">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Chưa có ai nhận giọt nước tuần này. Bạn nào sẽ là người đầu tiên?</p>
      ) : (
        <ol className="mt-2 grid gap-1">
          {rows.map((r, i) => (
            <li key={r.studentId} className={cn("flex items-center gap-2.5 rounded-xl px-2 py-1.5", i < 3 && "bg-gold-soft")}>
              <span className="w-7 text-center font-display text-lg font-extrabold text-ink-soft">{MEDALS[i] ?? i + 1}</span>
              <Avatar emoji={r.avatarEmoji} url={r.avatarUrl} name={r.fullName} size={32} />
              <span className="min-w-0 flex-1 truncate font-semibold">{r.fullName}</span>
              <span className="point-count">+{r.points}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
