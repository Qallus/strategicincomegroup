"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck2, CalendarClock, ChevronLeft, ChevronRight, ListTodo, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { makeRequest, widgetRequest } from "@/lib/dashboard/requests";
import type { CalendarItem } from "@/lib/dashboard/data/calendar";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, useMounted, type WidgetProps } from "./shell";

// Month view + agenda of bookings, events and task due dates (adapted from
// components/plans/views/calendar-view.tsx). Task due dates are all-day (UTC date).

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const KIND = {
  booking: { icon: CalendarClock, dot: "bg-[var(--series-1)]", label: "Appointment" },
  event: { icon: PartyPopper, dot: "bg-[var(--series-2)]", label: "Event" },
  task: { icon: ListTodo, dot: "bg-[var(--series-4)]", label: "Task due" },
} as const;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const itemDay = (i: CalendarItem) => (i.allDay ? i.start.slice(0, 10) : ymd(new Date(i.start)));
const timeOf = (i: CalendarItem) => (i.allDay ? "All day" : new Date(i.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));

function Agenda({ items, empty }: { items: CalendarItem[]; empty: string }) {
  if (!items.length) return <WidgetEmpty icon={CalendarCheck2}>{empty}</WidgetEmpty>;
  return (
    <ul className="space-y-1">
      {items.map((i) => {
        const k = KIND[i.kind];
        return (
          <li key={i.id}>
            <Link href={i.href} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-xs transition hover:bg-muted/60">
              <span className="w-14 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">{timeOf(i)}</span>
              <span className={cn("h-6 w-1 shrink-0 rounded-full", k.dot)} style={i.color ? { background: i.color } : undefined} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{i.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{i.subtitle ?? k.label}</span>
              </span>
              <k.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={k.label} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function CalendarWidget({ widget, def, preview }: WidgetProps) {
  const mounted = useMounted();
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = React.useState(() => ymd(new Date()));
  const base = React.useMemo(() => widgetRequest(widget), [widget]);
  const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const now = new Date();
  const isCurrent = month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const req = React.useMemo(() => (base && !isCurrent ? makeRequest("calendar", { ...base.params, month }) : base), [base, isCurrent, month]);
  const { data, error, status, loading, refresh } = useWidgetData<{ items: CalendarItem[]; firm: boolean }>(req, { refreshMs: preview ? 0 : 5 * 60_000 });
  const agendaOnly = widget.settings.agendaOnly === true;

  const byDay = React.useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const i of data?.items ?? []) {
      const k = itemDay(i);
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return m;
  }, [data]);

  const today = mounted ? ymd(new Date()) : "";

  if (agendaOnly) {
    const items = mounted ? byDay.get(today) ?? [] : [];
    return (
      <WidgetShell icon={def.icon} title={def.title} subtitle={mounted ? new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : undefined} href="/dashboard/bookings" hrefLabel="Calendar" tone="sky">
        {loading && !data ? <WidgetSkeleton lines={4} /> : error ? <WidgetError error={error} status={status} onRetry={refresh} /> : <Agenda items={items} empty="Nothing scheduled today." />}
      </WidgetShell>
    );
  }

  const year = cursor.getFullYear();
  const mon = cursor.getMonth();
  const lead = new Date(year, mon, 1).getDay();
  const days = new Date(year, mon + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => new Date(year, mon, i + 1))];
  while (cells.length % 7) cells.push(null);
  const wide = widget.size === "l";
  const agendaItems = byDay.get(selected) ?? [];

  return (
    <WidgetShell
      icon={def.icon}
      title={cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      subtitle={data?.firm ? "Firm calendar" : "Your calendar"}
      tone="sky"
      actions={
        <div className="flex items-center gap-0.5">
          <button type="button" disabled={preview} onClick={() => setCursor(new Date(year, mon - 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" disabled={preview} onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(ymd(d)); }} className="h-7 rounded-full px-2 text-[11px] font-medium hover:bg-muted">Today</button>
          <button type="button" disabled={preview} onClick={() => setCursor(new Date(year, mon + 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
      }
    >
      <div className={cn("sig-viz grid gap-4", wide && "md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]")}>
        <div>
          <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {WEEKDAYS.map((d, i) => <span key={i} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const key = ymd(d);
              const items = byDay.get(key) ?? [];
              const isToday = key === today;
              const isSel = key === selected;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={preview}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "relative flex aspect-square min-h-[2rem] flex-col items-center justify-center rounded-lg text-xs tabular-nums transition",
                    isSel ? "bg-brand-navy text-white shadow-sm dark:bg-brand-gold dark:text-brand-navy-deep" : "hover:bg-muted",
                    isToday && !isSel && "font-bold text-brand-navy ring-1 ring-inset ring-brand-gold dark:text-brand-gold",
                  )}
                  aria-label={`${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${items.length} item${items.length === 1 ? "" : "s"}`}
                  aria-pressed={isSel}
                >
                  {d.getDate()}
                  {items.length ? (
                    <span className="absolute bottom-1 flex gap-0.5" aria-hidden>
                      {[...new Set(items.map((x) => x.kind))].slice(0, 3).map((k) => (
                        <span key={k} className={cn("h-1 w-1 rounded-full", isSel ? "bg-current" : KIND[k].dot)} />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", KIND[k].dot)} aria-hidden />{KIND[k].label}</span>
            ))}
          </div>
        </div>
        <div className={cn(!wide && "border-t border-border/60 pt-3")}>
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
            {new Date(`${selected}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
          {loading && !data ? <WidgetSkeleton lines={3} /> : error ? <WidgetError error={error} status={status} onRetry={refresh} /> : <Agenda items={agendaItems} empty="Nothing on this day." />}
        </div>
      </div>
    </WidgetShell>
  );
}
