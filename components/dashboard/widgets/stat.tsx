"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, KeyRound, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { StatResult } from "@/lib/dashboard/data/stats";
import { useWidgetData } from "../use-widget-data";
import { useOptionalDashboard } from "../dashboard-context";
import { type WidgetProps } from "./shell";

// "More is worse" metrics flip the delta colours.
const BAD_WHEN_UP = new Set(["calls_missed", "alerts", "notifications"]);

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const w = 120;
  const h = 32;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 2 - (v / max) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("sig-viz h-8 w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${id})`} />
      <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function StatWidget({ widget, def, preview }: WidgetProps) {
  const dash = useOptionalDashboard();
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading } = useWidgetData<StatResult>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const Icon = def.icon;
  const metric = String(widget.settings.metric ?? "");
  const market = ["market", "dow", "nasdaq", "sp500"].includes(metric);

  let tone: "good" | "bad" | "flat" = "flat";
  if (data?.delta != null && Math.abs(data.delta) >= 0.05) {
    const up = data.delta > 0;
    tone = market ? (up ? "good" : "bad") : BAD_WHEN_UP.has(metric) ? (up ? "bad" : "good") : up ? "good" : "bad";
  }
  const DeltaIcon = data?.delta == null || tone === "flat" ? Minus : data.delta > 0 ? ArrowUpRight : ArrowDownRight;

  const body = (
    <div className="flex h-full min-h-[9.5rem] flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-muted-foreground">{def.title}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy/[0.07] text-brand-navy ring-1 ring-inset ring-brand-navy/10 dark:bg-brand-gold/10 dark:text-brand-gold dark:ring-brand-gold/15">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>

      {loading && !data ? (
        <div className="mt-3 space-y-2">
          <div className="sig-skeleton h-8 w-20" />
          <div className="sig-skeleton h-3 w-28" />
        </div>
      ) : error ? (
        <p className="mt-3 text-xs text-muted-foreground">{status === 403 ? "No access" : "Unavailable right now"}</p>
      ) : data?.state === "connect_markets" ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-2xl font-semibold tabular-nums text-muted-foreground/60">—</p>
          {dash?.viewer.isSuperAdmin ? (
            <Link href="/dashboard/credentials?tab=data_feeds" className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy hover:underline dark:text-brand-gold">
              <KeyRound className="h-3 w-3" aria-hidden /> Connect a market data key
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Market data isn&apos;t connected yet.</p>
          )}
        </div>
      ) : data ? (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className={cn("font-semibold tracking-tight tabular-nums", data.display.length > 9 ? "text-2xl" : "text-3xl")}>{data.display}</p>
            {data.delta != null && data.state !== "unavailable" ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  tone === "good" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  tone === "bad" && "bg-red-500/10 text-red-600 dark:text-red-400",
                  tone === "flat" && "bg-muted text-muted-foreground",
                )}
                title={market ? "Change today" : `vs the previous ${data.periodLabel?.replace(/^(last |this )/, "") ?? "period"}`}
              >
                <DeltaIcon className="h-3 w-3" aria-hidden />
                {Math.abs(data.delta).toFixed(Math.abs(data.delta) < 10 ? 1 : 0)}%
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{data.detail}</p>
          <div className="mt-auto pt-2">
            {data.spark ? <Sparkline values={data.spark} /> : null}
            {data.scope && dash?.viewer.isAdmin ? (
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{data.scope === "firm" ? "Firm" : "Mine"}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );

  if (data?.href && !preview) {
    return (
      <Link href={data.href} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${def.title}: ${data.display}`}>
        {body}
      </Link>
    );
  }
  return body;
}
