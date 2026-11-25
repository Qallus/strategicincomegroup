"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronRight, Rocket, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { ChecklistItem } from "@/lib/dashboard/data/insights";
import { useWidgetData } from "../use-widget-data";
import { useOptionalDashboard } from "../dashboard-context";
import { WidgetError, type WidgetProps } from "./shell";

type Data = { items: ChecklistItem[]; done: number; total: number; dismissed: boolean };

function Ring({ value, total }: { value: number; total: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="hsl(var(--brand-gold))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
      />
    </svg>
  );
}

export default function GetStartedWidget({ widget, preview }: WidgetProps) {
  const dash = useOptionalDashboard();
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<Data>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });

  const act = (item: ChecklistItem) => {
    if (item.action === "wizard") dash?.openWizard();
    if (item.action === "post_update") dash?.openPostUpdate();
  };

  return (
    <div className="sig-dash-hero relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="flex shrink-0 items-center gap-3">
        <div className="relative">
          <Ring value={data?.done ?? 0} total={data?.total ?? 1} />
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
            {data ? `${data.done}/${data.total}` : <Rocket className="h-4 w-4 text-brand-gold" aria-hidden />}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Get started</p>
          <p className="text-xs text-muted-foreground">{data && data.done === data.total ? "You're all set." : "A few steps to set up SIG for you."}</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {loading && !data ? (
          <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="sig-skeleton h-12 w-44 shrink-0" />)}</div>
        ) : error ? (
          <WidgetError error={error} status={status} onRetry={refresh} />
        ) : (
          <ul className="sig-noscroll -mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-0.5">
            {data?.items.map((item) => {
              const inner = (
                <>
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]",
                      item.done ? "border-transparent bg-brand-sage text-white" : "border-border bg-background",
                    )}
                    aria-hidden
                  >
                    {item.done ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className={cn("block truncate text-xs font-semibold", item.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{item.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{item.detail}</span>
                  </span>
                  {!item.done ? <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                </>
              );
              const cls = "flex w-56 shrink-0 snap-start items-center gap-2.5 rounded-xl border border-border/70 bg-background/70 px-3 py-2 backdrop-blur transition hover:border-brand-gold/50";
              return (
                <li key={item.key}>
                  {item.href && !preview ? (
                    <Link href={item.href} className={cls}>{inner}</Link>
                  ) : (
                    <button type="button" disabled={preview} onClick={() => act(item)} className={cls}>{inner}</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={preview}
          onClick={() => dash?.openWizard()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-navy px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-navy/90 dark:bg-brand-gold dark:text-brand-navy-deep"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden /> Personalize
        </button>
        {!preview ? (
          <button
            type="button"
            onClick={() => dash?.dismissGetStarted()}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground sm:static"
            aria-label="Dismiss the Get started checklist"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
