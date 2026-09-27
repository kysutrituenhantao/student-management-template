"use client";

import type { SchoolRanking } from "@lhhp/shared";
import { cn } from "@/lib/utils";

/**
 * Kết quả thi đua (brief 12): "xếp loại điểm từ cao đến thấp theo biểu đồ hình cột (riêng lớp 4C luôn là cột màu đỏ để
 * nổi bật và dễ nhận thấy vị trí của lớp ở trường)". One series, highest first, from a zero baseline so a column's
 * height is its score. Her class is the one red column; the rest share a quiet blue (the pair passes the colour-blind
 * and contrast checks on white). Every column carries its score and name as text, so nothing rests on colour alone,
 * and the same ranking is readable as a list under the chart.
 */

const OURS = "#d92d48";
const OTHERS = "#5b8fd6";
const HEIGHT = 220;

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** "Lớp 4C đứng thứ 2/12", with ties sharing a place. */
export function ourPlace(ranking: SchoolRanking): { name: string; rank: number; of: number } | null {
  const ours = ranking.rows.find((r) => r.isOurs);
  if (!ours) return null;
  return { name: ours.name, rank: 1 + ranking.rows.filter((r) => r.score > ours.score).length, of: ranking.rows.length };
}

export function CompetitionChart({ ranking }: { ranking: SchoolRanking }) {
  const top = Math.max(...ranking.rows.map((r) => r.score), 1);
  const place = ourPlace(ranking);
  return (
    <figure aria-label={`Biểu đồ Kết quả thi đua, ${ranking.periodLabel}`} className="grid gap-3">
      {place ? (
        <figcaption className="text-lg">
          <span aria-hidden>🚩</span> <strong>{place.name}</strong> đứng thứ <strong className="text-2xl">{place.rank}/{place.of}</strong> trong trường
        </figcaption>
      ) : null}
      {/* Many classes scroll inside the chart on a phone; the page itself never moves sideways. */}
      <div className="overflow-x-auto pb-1">
        {/* "safe center": centred while it fits, and starting at the first column when it doesn't, never cut on the left. */}
        <ol className="flex min-w-full items-end gap-[2px] px-1" style={{ height: HEIGHT + 64, justifyContent: "safe center" }} aria-hidden>
          {ranking.rows.map((r, i) => (
            <li
              key={i}
              data-column
              data-name={r.name}
              data-score={r.score}
              className="flex h-full min-w-[26px] max-w-[76px] flex-1 flex-col items-center justify-end sm:min-w-[34px]"
              title={`${r.name}: ${fmt(r.score)} điểm`}
            >
              <span className={cn("mb-1 text-[0.7rem] tabular-nums sm:text-sm", r.isOurs ? "font-extrabold" : "font-semibold text-ink-soft")}>{fmt(r.score)}</span>
              <span
                data-bar
                className="w-[calc(100%-6px)] max-w-[56px] rounded-t-[4px]"
                style={{ height: Math.max(3, Math.round((r.score / top) * HEIGHT)), backgroundColor: r.isOurs ? OURS : OTHERS }}
              />
              <span
                className={cn(
                  // Its top border, column after column, is the chart's baseline.
                  "line-clamp-2 min-h-[2.4em] w-full break-words border-t-2 border-line pt-1.5 text-center text-[0.68rem] leading-tight sm:text-xs",
                  r.isOurs ? "font-extrabold" : "text-ink-soft",
                )}
              >
                {r.name}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-ink-soft">Xem dạng bảng</summary>
        <ol className="mt-2 grid gap-1">
          {ranking.rows.map((r, i) => (
            <li key={i} className={cn("flex gap-2 rounded-lg px-2 py-1", r.isOurs && "bg-pink-soft font-bold")}>
              <span className="w-6 text-right tabular-nums">{1 + ranking.rows.filter((x) => x.score > r.score).length}.</span>
              <span className="flex-1">{r.name}</span>
              <span className="tabular-nums">{fmt(r.score)}</span>
            </li>
          ))}
        </ol>
      </details>
    </figure>
  );
}
