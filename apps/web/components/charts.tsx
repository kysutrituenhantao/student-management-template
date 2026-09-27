"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Chart colours, validated with the dataviz palette checker against the white surface (lightness band, chroma,
 * colour-blind separation ΔE 24, contrast ≥ 3:1): gold for drops given, blue for drops taken away.
 */
export const PLUS = "#B98100";
export const MINUS = "#4F86D0";
const GRID = "#ece4f3";
const AXIS_TEXT = "#6b5a7b";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Older phones have no ResizeObserver: measure now and on window resizes instead.
    if (typeof ResizeObserver === "undefined") {
      const measure = () => setWidth(Math.floor(el.clientWidth));
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(n: number): number {
  if (n <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= n) return m * pow;
  return 10 * pow;
}

/** A column with a 4px rounded data end and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number, up: boolean): string {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return "";
  return up
    ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
    : `M${x},${y} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w - r} Q${x + w},${y + h} ${x + w},${y + h - r} V${y} Z`;
}

export interface Column {
  label: string;
  plus: number;
  minus: number;
}

/** Drops given (up, gold) and taken away (down, blue) per day, week or month, on one shared axis. */
export function DivergingColumns({ data, title, height = 220 }: { data: Column[]; title: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const maxPlus = Math.max(0, ...data.map((d) => d.plus));
  const maxMinus = Math.max(0, ...data.map((d) => d.minus));
  const top = niceMax(maxPlus || 1);
  const bottom = maxMinus ? niceMax(maxMinus) : 0;
  const pad = { l: 34, r: 8, t: 22, b: 26 };
  const plotH = height - pad.t - pad.b;
  const scale = plotH / (top + bottom);
  const base = pad.t + top * scale;
  const band = data.length ? (width - pad.l - pad.r) / data.length : 0;
  const barW = Math.min(24, Math.max(6, band * 0.55));
  const peak = data.reduce((best, d, i) => (d.plus > (data[best]?.plus ?? -1) ? i : best), 0);
  const ticks = [top, top / 2, 0, ...(bottom ? [-bottom] : [])];
  const empty = maxPlus === 0 && maxMinus === 0;

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-display text-lg font-bold">{title}</span>
        <span className="flex items-center gap-3 text-sm text-ink-soft" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: PLUS }} /> Giọt nước được cộng
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: MINUS }} /> Giọt nước bị trừ
          </span>
        </span>
      </figcaption>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={`${title}. Xem bảng số liệu bên dưới.`}>
            {ticks.map((t) => {
              const y = base - t * scale;
              // A tick label closer than 14px to the baseline would sit on top of the "0".
              const crowded = t !== 0 && Math.abs(t * scale) < 14;
              return (
                <g key={t}>
                  <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={t === 0 ? "#cbbcd9" : GRID} strokeWidth={1} />
                  {crowded ? null : (
                    <text x={pad.l - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>
                      {t < 0 ? `−${-t}` : t}
                    </text>
                  )}
                </g>
              );
            })}
            {data.map((d, i) => {
              const cx = pad.l + band * i + band / 2;
              const x = cx - barW / 2;
              const hPlus = d.plus * scale;
              const hMinus = d.minus * scale;
              return (
                <g key={d.label}>
                  {hover === i ? (
                    // The column being read, by pointer or keyboard, gets a quiet frame.
                    <rect x={pad.l + band * i + 2} y={pad.t - 8} width={band - 4} height={plotH + 8} rx={6} fill="none" stroke="#c2336a" strokeWidth={1.5} />
                  ) : null}
                  {/* 2px surface gap between the column and the baseline keeps the two directions apart. */}
                  <path d={columnPath(x, base - hPlus - 1, barW, Math.max(0, hPlus - 1), true)} fill={PLUS} opacity={hover === null || hover === i ? 1 : 0.55} />
                  <path d={columnPath(x, base + 1, barW, Math.max(0, hMinus - 1), false)} fill={MINUS} opacity={hover === null || hover === i ? 1 : 0.55} />
                  {i === peak && d.plus > 0 ? (
                    <text x={cx} y={base - hPlus - 7} textAnchor="middle" fontSize={12} fontWeight={700} fill="#3b2a4a">
                      {d.plus}
                    </text>
                  ) : null}
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                    {d.label}
                  </text>
                  <rect
                    x={pad.l + band * i}
                    y={pad.t - 10}
                    width={band}
                    height={plotH + 10}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.label}: cộng ${d.plus} giọt nước, trừ ${d.minus} giọt nước`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    style={{ outline: "none" }}
                  />
                </g>
              );
            })}
          </svg>
        ) : null}
        {hover !== null && data[hover] && width > 0 ? (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-lg"
            style={{
              left: Math.min(Math.max(pad.l + band * hover + band / 2 - 70, 0), width - 140),
              top: 0,
              width: 140,
            }}
          >
            <p className="text-ink-soft">{data[hover].label}</p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-3" style={{ background: PLUS }} />
              <strong>+{data[hover].plus}</strong> <span className="text-ink-soft">cộng</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-3" style={{ background: MINUS }} />
              <strong>−{data[hover].minus}</strong> <span className="text-ink-soft">trừ</span>
            </p>
          </div>
        ) : null}
        {empty && width > 0 ? (
          <p className="absolute inset-x-0 top-1/3 text-center text-sm text-ink-soft">Chưa có giọt nước nào trong khoảng này.</p>
        ) : null}
      </div>
      <details className="mt-2 text-sm">
        <summary className="inline-block py-2 text-blue-ink">Xem dạng bảng</summary>
        <table className="mt-2 w-full max-w-md text-left" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 font-semibold">Thời gian</th>
              <th className="py-1 text-right font-semibold">Cộng</th>
              <th className="py-1 text-right font-semibold">Trừ</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">+{d.plus}</td>
                <td className="py-1 text-right">−{d.minus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** One series of horizontal bars, value at each tip. For a handful of rows only (categories, top reasons). */
export function HBars({ rows, title, empty }: { rows: { label: string; value: number; emoji?: string | null }[]; title: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="m-0">
      <figcaption className="mb-2 font-display text-lg font-bold">{title}</figcaption>
      {rows.length === 0 || rows.every((r) => r.value === 0) ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="grid gap-2.5">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-3 text-[0.92rem]">
              <span className="truncate" title={r.label}>
                {r.emoji ? <span aria-hidden>{r.emoji} </span> : null}
                {r.label}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="block h-3.5 rounded-r-[4px]"
                  style={{ width: `calc(${(r.value / max) * 100}% - 2.5rem)`, minWidth: r.value ? 3 : 0, background: PLUS }}
                />
                <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.value}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Done out of total, on a same-hue track. Green, so it never reads as the blue of drops taken away. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{max ? `${pct}%` : "–"}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#d5f0e0]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#22744a" }} />
      </div>
    </div>
  );
}
