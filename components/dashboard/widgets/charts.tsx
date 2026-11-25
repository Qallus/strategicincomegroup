"use client";

import * as React from "react";
import { ChartLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest } from "@/lib/dashboard/requests";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, type WidgetProps } from "./shell";

// Trend lines on ONE shared count axis (no dual axis), colours from the validated .sig-viz
// tokens in a fixed order, light gridlines, a crosshair with a single tooltip listing every
// series, and direct end labels so a legend isn't needed to read the lines.

type Data = { days: string[]; series: { key: string; label: string; values: number[] }[]; firm: boolean };

const COLOR: Record<string, string> = { calls: "var(--series-1)", sms: "var(--series-2)", bookings: "var(--series-4)" };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function ChartsWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<Data>(req, { refreshMs: preview ? 0 : 10 * 60_000 });
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 64, t: 12, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = data?.days.length ?? 0;
  const max = niceMax(Math.max(1, ...(data?.series.flatMap((s) => s.values) ?? [1])));
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || n < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1)))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!n) return;
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    if (e.key === "Escape") setHover(null);
  };

  const totals = data?.series.map((s) => ({ ...s, total: s.values.reduce((t, v) => t + v, 0) })) ?? [];
  const labelYs = React.useMemo(() => {
    // De-collide the end labels (min 13px apart in viewBox units).
    const ends = totals.map((s) => ({ key: s.key, y: y(s.values[n - 1] ?? 0) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    return Object.fromEntries(ends.map((e) => [e.key, Math.min(e.y, pad.t + ih)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, max]);

  return (
    <WidgetShell icon={def.icon} title={def.title} subtitle={data ? `Last ${n} days · ${data.firm ? "firm" : "yours"}` : undefined} tone="navy">
      {loading && !data ? (
        <WidgetSkeleton lines={5} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : !data?.series.length ? (
        <WidgetEmpty icon={ChartLine}>Turn on at least one series in card settings.</WidgetEmpty>
      ) : (
        <div className="sig-viz">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
            {totals.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-xs">
                <span className="h-2 w-3 rounded-full" style={{ background: COLOR[s.key] }} aria-hidden />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold tabular-nums">{(hover != null ? s.values[hover] : s.total).toLocaleString()}</span>
              </span>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">{hover != null ? shortDay(data.days[hover]) : `${shortDay(data.days[0])} – ${shortDay(data.days[n - 1])}`}</span>
          </div>
          <div className="relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="img"
              aria-label={`${def.title}: ${totals.map((s) => `${s.label} ${s.total}`).join(", ")} over ${n} days`}
              tabIndex={preview ? -1 : 0}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              onKeyDown={onKey}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 4"} />
                  <text x={pad.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground" fontSize="10">{Math.round(t)}</text>
                </g>
              ))}
              {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
                <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted-foreground" fontSize="10">{shortDay(data.days[i])}</text>
              ))}
              {totals.map((s) => {
                const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
                return (
                  <g key={s.key}>
                    <path d={d} fill="none" stroke={COLOR[s.key]} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={3} fill={COLOR[s.key]} />
                    <text x={W - pad.r + 8} y={labelYs[s.key]} dominantBaseline="middle" fontSize="11" fontWeight={600} fill={COLOR[s.key]}>{s.label}</text>
                  </g>
                );
              })}
              {hover != null ? (
                <g pointerEvents="none">
                  <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="hsl(var(--foreground) / 0.35)" strokeWidth={1} />
                  {totals.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill="hsl(var(--card))" stroke={COLOR[s.key]} strokeWidth={2} />)}
                </g>
              ) : null}
            </svg>
            {hover != null ? (
              <div
                className={cn("pointer-events-none absolute top-2 z-10 min-w-[8rem] rounded-lg border border-border bg-popover/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur")}
                style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "calc(-100% - 10px)" : "10px"})` }}
                role="status"
              >
                <p className="mb-1 font-semibold">{shortDay(data.days[hover])}</p>
                {totals.map((s) => (
                  <p key={s.key} className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: COLOR[s.key] }} aria-hidden />{s.label}</span>
                    <span className="font-semibold tabular-nums">{s.values[hover] ?? 0}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
