"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck2, CalendarClock, ListTodo, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { CalendarItem, NextUp } from "@/lib/dashboard/data/calendar";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, useNow, type WidgetProps } from "./shell";

const KIND_ICON = { booking: CalendarClock, event: PartyPopper, task: ListTodo } as const;
const KIND_LABEL = { booking: "Appointment", event: "Event", task: "Task due" } as const;

function countdown(ms: number): string {
  if (ms <= 0) return "Now";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

export function whenLabel(item: Pick<CalendarItem, "start" | "allDay">): string {
  const d = new Date(item.start);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(item.allDay ? { timeZone: "UTC" } : {}) });
  return item.allDay ? day : `${day} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export default function NextUpWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<NextUp>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const now = useNow(30_000);
  const item = data?.item;
  const Icon = item ? KIND_ICON[item.kind] : CalendarCheck2;
  const ms = item ? new Date(item.start).getTime() - now : 0;
  const soon = item && !item.allDay && ms < 60 * 60_000;

  return (
    <WidgetShell icon={def.icon} title={def.title} href="/dashboard/bookings" hrefLabel="Calendar" tone="sky">
      {loading && !data ? (
        <WidgetSkeleton lines={3} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : !item ? (
        <WidgetEmpty icon={CalendarCheck2}>Nothing on your calendar. Enjoy the open space.</WidgetEmpty>
      ) : (
        <div className="flex h-full flex-col gap-3">
          <Link href={item.href} className="group relative block overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-brand-navy/[0.06] to-brand-gold/[0.08] p-3.5 transition hover:border-brand-gold/50 dark:from-brand-gold/[0.07] dark:to-brand-sky/[0.05]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-brand-gold" aria-hidden />
                {KIND_LABEL[item.kind]}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", soon ? "bg-brand-gold text-brand-navy-deep" : "bg-background/80 text-foreground")}>
                {item.allDay ? (ms < 86_400_000 ? "Today" : countdown(ms)) : countdown(ms)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{item.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{[item.subtitle, whenLabel(item)].filter(Boolean).join(" · ")}</p>
            {item.color ? <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: item.color }} /> : null}
          </Link>
          {data.following.length ? (
            <ul className="space-y-1.5">
              {data.following.map((f) => {
                const FIcon = KIND_ICON[f.kind];
                return (
                  <li key={f.id}>
                    <Link href={f.href} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition hover:bg-muted/60">
                      <FIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{f.title}</span>
                      <span className="shrink-0 text-muted-foreground">{whenLabel(f)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}
