"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, KeyRound, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { MarketsResult, Quote } from "@/lib/markets/finnhub";
import { useWidgetData } from "../use-widget-data";
import { useOptionalDashboard } from "../dashboard-context";
import { WidgetError, type WidgetProps } from "./shell";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function QuoteChip({ q, compact = false }: { q: Quote; compact?: boolean }) {
  const up = q.changePercent >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn("min-w-0 rounded-xl border border-border/70 bg-background/60 px-3 py-2", compact && "px-2.5 py-1.5")}>
      <p className="truncate text-[11px] font-medium text-muted-foreground">{q.label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{usd(q.price)}</p>
      <p className={cn("mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
        <Arrow className="h-3 w-3" aria-hidden />
        {up ? "+" : ""}
        {q.changePercent.toFixed(2)}%
      </p>
    </div>
  );
}

export function MarketStatus({ open }: { open: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", open ? "sig-pulse-dot bg-brand-sage" : "bg-muted-foreground/50")} aria-hidden />
      {open ? "Market open" : "Market closed"}
    </span>
  );
}

export function ConnectMarkets() {
  const dash = useOptionalDashboard();
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Live quotes need a market data key.</p>
      {dash?.viewer.isSuperAdmin ? (
        <Link href="/dashboard/credentials?tab=data_feeds" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-2.5 py-1.5 font-semibold text-white hover:bg-brand-navy/90 dark:bg-brand-gold dark:text-brand-navy-deep">
          <KeyRound className="h-3.5 w-3.5" aria-hidden /> Connect a market data key
        </Link>
      ) : (
        <p>Ask a super admin to connect Finnhub under Credentials → Data feeds.</p>
      )}
    </div>
  );
}

export default function MarketsWidget({ widget, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<MarketsResult>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const funds = data?.configured ? data.quotes.filter((q) => ["DIA", "QQQ", "SPY"].includes(q.symbol)) : [];

  return (
    <div className="flex h-full min-h-[7.5rem] flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold"><TrendingUp className="h-3.5 w-3.5 text-brand-gold" aria-hidden /> Markets</p>
        {data ? <MarketStatus open={data.open} /> : null}
      </div>
      {loading && !data ? (
        <div className="grid flex-1 grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="sig-skeleton h-full min-h-[3.5rem]" />)}</div>
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : data && !data.configured ? (
        <ConnectMarkets />
      ) : funds.length ? (
        <div className="grid flex-1 grid-cols-3 gap-2">{funds.map((q) => <QuoteChip key={q.symbol} q={q} compact />)}</div>
      ) : (
        <p className="text-xs text-muted-foreground">{data && "error" in data && data.error ? data.error : "Quotes are unavailable right now."}</p>
      )}
    </div>
  );
}
