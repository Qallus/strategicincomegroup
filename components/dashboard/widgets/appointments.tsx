"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Mail, MessageSquareText } from "lucide-react";
import { widgetRequest } from "@/lib/dashboard/requests";
import type { AppointmentItem } from "@/lib/dashboard/data/calendar";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, useMounted, type WidgetProps } from "./shell";

function when(a: AppointmentItem) {
  const tz = a.timezone || "America/Phoenix";
  const d = new Date(a.start);
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  const today = key(new Date());
  const tomorrow = key(new Date(Date.now() + 86_400_000));
  const day = key(d) === today ? "Today" : key(d) === tomorrow ? "Tomorrow" : d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
  return { day, time: d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) };
}

export default function AppointmentsWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<{ items: AppointmentItem[]; firmWide: boolean }>(req, { refreshMs: preview ? 0 : 120_000 });
  const mounted = useMounted();

  return (
    <WidgetShell
      icon={def.icon}
      title={data?.firmWide ? "Upcoming appointments (all planners)" : "Your upcoming appointments"}
      href="/dashboard/bookings"
      hrefLabel="Bookings"
      tone="sky"
    >
      {loading && !data ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : !data?.items.length ? (
        <WidgetEmpty icon={CalendarClock}>No upcoming appointments on your calendar.</WidgetEmpty>
      ) : (
        <ul className="-mx-1 divide-y divide-border/60">
          {data.items.map((a) => {
            const w = mounted ? when(a) : { day: "", time: "" };
            return (
              <li key={a.id}>
                <Link href="/dashboard/bookings" className="flex items-center gap-3 rounded-lg px-1 py-2 transition hover:bg-muted/50">
                  <span className="w-[4.5rem] shrink-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{w.day}</span>
                    <span className="block text-sm font-semibold tabular-nums">{w.time}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{a.invitee}</span>
                    <span className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color || "hsl(var(--primary))" }} />
                      {a.type}
                      {data.firmWide && a.host ? ` · ${a.host}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    <Mail className={a.notifyEmail ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 opacity-30"} aria-label={a.notifyEmail ? "Email reminders on" : "Email reminders off"} />
                    <MessageSquareText className={a.notifySms ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 opacity-30"} aria-label={a.notifySms ? "Text reminders on" : "Text reminders off"} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}
