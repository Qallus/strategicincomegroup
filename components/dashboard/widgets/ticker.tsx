"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { MarketsResult } from "@/lib/markets/finnhub";
import { useWidgetData } from "../use-widget-data";
import { ConnectMarkets, MarketStatus } from "./markets";
import { WidgetError, type WidgetProps } from "./shell";

export default function TickerWidget({ widget, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<MarketsResult>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const symbol = String(widget.settings.symbol ?? "AAPL").toUpperCase();
  const q = data?.configured ? data.quotes.find((x) => x.symbol === symbol) : undefined;

  return (
    <div className="flex h-full min-h-[9.5rem] flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-wide">{symbol}</p>
        {data ? <MarketStatus open={data.open} /> : null}
      </div>
      {loading && !data ? (
        <div className="mt-3 space-y-2"><div className="sig-skeleton h-8 w-24" /><div className="sig-skeleton h-3 w-16" /></div>
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : data && !data.configured ? (
        <div className="mt-2 flex-1"><ConnectMarkets /></div>
      ) : q ? (
        <>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{q.price.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
          <p className={cn("mt-1 inline-flex items-center gap-1 text-xs font-semibold tabular-nums", q.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {q.change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
            {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)} ({q.changePercent.toFixed(2)}%)
          </p>
          <div className="mt-auto grid grid-cols-3 gap-2 pt-3 text-[11px] text-muted-foreground">
            <span>Open <b className="block font-medium text-foreground tabular-nums">{q.open.toFixed(2)}</b></span>
            <span>High <b className="block font-medium text-foreground tabular-nums">{q.high.toFixed(2)}</b></span>
            <span>Low <b className="block font-medium text-foreground tabular-nums">{q.low.toFixed(2)}</b></span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No quote for {symbol}. Check the symbol in card settings.</p>
      )}
    </div>
  );
}
