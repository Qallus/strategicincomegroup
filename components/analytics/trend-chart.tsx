"use client";

import * as React from "react";
import { Table2, LineChart } from "lucide-react";
import { formatDay } from "@/lib/analytics/dates";
import { cn } from "@/lib/utils";
import { compact, full, niceTicks } from "./format";

export type TrendSeries = { key: string; label: string; color: string; values: number[] };

/**
 * Multi-series line chart over days (dataviz specs): one y-axis, 2px lines, hairline
 * grid, legend for 2+ series, crosshair that snaps to the nearest day with one
 * tooltip listing every series (value first), keyboard arrows, and a table view.
 */
export function TrendChart({
  days,
  series,
  valueName,
  height = 240,
  className,
}: {
  days: string[];
  series: TrendSeries[];
  valueName: string;
  height?: number;
  className?: string;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(640);
  const [hover, setHover] = React.useState<number | null>(null);
  const [table, setTable] = React.useState(false);

  React.useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);

  const n = days.length;
  const m = { l: 40, r: 12, t: 10, b: 26 };
  const iw = Math.max(1, width - m.l - m.r);
  const ih = Math.max(1, height - m.t - m.b);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const xTickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 90))));

  function indexAt(clientX: number) {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const px = clientX - rect.left - m.l;
    return Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px / iw) * (n - 1))));
  }

  const hoverRows = hover == null ? [] : series.map((s) => ({ ...s, v: s.values[hover] ?? 0 })).sort((a, b) => b.v - a.v);
  const tipLeft = hover == null ? 0 : x(hover);
  const tipOnLeft = tipLeft > width * 0.6;

  return (
    <figure className={cn("sig-viz", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
            {series.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5">
                <svg width="14" height="4" aria-hidden>
                  <line x1="1" y1="2" x2="13" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                </svg>
                {s.label}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-pressed={table}
        >
          {table ? <LineChart className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {table ? "Show chart" : "Show table"}
        </button>
      </div>

      {table ? (
        <div className="max-h-80 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {days.map((d, i) => (
                <tr key={d} className="border-t">
                  <td className="px-3 py-1.5">{formatDay(d, { weekday: "short", month: "short", day: "numeric" })}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">{full(s.values[i] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative w-full select-none" style={{ height }}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${valueName} per day, ${formatDay(days[0] ?? "")} to ${formatDay(days[n - 1] ?? "")}. Use the table view for exact values.`}
            className="block overflow-visible"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth={1} />
                <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}
            {days.map((d, i) =>
              i % xTickEvery === 0 || i === n - 1 ? (
                i === n - 1 && i % xTickEvery !== 0 && n - 1 - Math.floor((n - 1) / xTickEvery) * xTickEvery < xTickEvery / 2 ? null : (
                  <text key={d} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
                    {formatDay(d)}
                  </text>
                )
              ) : null,
            )}
            {series.map((s) => (
              <path
                key={s.key}
                d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {n === 1
              ? series.map((s) => <circle key={s.key} cx={x(0)} cy={y(s.values[0] ?? 0)} r={4} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2} />)
              : null}
            {hover != null ? (
              <g aria-hidden>
                <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeWidth={1} />
                {series.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2} />
                ))}
              </g>
            ) : null}
            <rect
              x={m.l - 8}
              y={0}
              width={iw + 16}
              height={height}
              fill="transparent"
              tabIndex={0}
              aria-label="Chart — use left and right arrow keys to read each day"
              className="cursor-crosshair outline-none focus-visible:stroke-[hsl(var(--ring))]"
              onPointerMove={(e) => setHover(indexAt(e.clientX))}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover((h) => h ?? n - 1)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
                if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? 0) + 1));
              }}
            />
          </svg>
          {hover != null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
              style={tipOnLeft ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}
            >
              <p className="mb-1 font-medium text-muted-foreground">{formatDay(days[hover], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
              <ul className="space-y-0.5">
                {hoverRows.map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <svg width="10" height="4" aria-hidden>
                      <line x1="1" y1="2" x2="9" y2="2" stroke={r.color} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="font-semibold tabular-nums text-foreground">{full(r.v)}</span>
                    <span className="text-muted-foreground">{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}
