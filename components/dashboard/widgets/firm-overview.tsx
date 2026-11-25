"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, MailCheck, MessageSquare, Phone, UserPlus, UsersRound } from "lucide-react";
import { widgetRequest } from "@/lib/dashboard/requests";
import type { SigOverview } from "@/lib/dashboard/overview";
import { useWidgetData } from "../use-widget-data";
import { WidgetError, WidgetShell, WidgetSkeleton, type WidgetProps } from "./shell";

export default function FirmOverviewWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<SigOverview>(req, { refreshMs: preview ? 0 : 5 * 60_000 });
  const metrics = data
    ? [
        { label: "Contacts", value: data.contacts, detail: "Active CRM contacts", icon: UsersRound, href: "/dashboard/contacts" },
        { label: "Leads", value: data.leads, detail: "Open leads", icon: UserPlus, href: "/dashboard/contacts" },
        { label: "Upcoming appointments", value: data.upcomingBookings, detail: `${data.bookingsThisMonth} booked this month`, icon: CalendarClock, href: "/dashboard/bookings" },
        { label: "SMS conversations", value: data.smsConversations, detail: "All time", icon: MessageSquare, href: "/dashboard/sms" },
        { label: "Calls this month", value: data.callsThisMonth, detail: "Inbound and outbound", icon: Phone, href: "/dashboard/dialer" },
        { label: "Emails this month", value: data.emailsThisMonth, detail: `${data.publishedPosts} published blog posts`, icon: MailCheck, href: "/dashboard/emails" },
      ]
    : [];
  return (
    <WidgetShell icon={def.icon} title={def.title} tone="navy">
      {loading && !data ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {metrics.map((m) => (
              <li key={m.label}>
                <Link href={m.href} className="flex h-full flex-col rounded-xl border border-border/70 bg-background/60 p-3 transition hover:border-brand-gold/50">
                  <span className="flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
                    <span className="truncate">{m.label}</span>
                    <m.icon className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden />
                  </span>
                  <span className="mt-1 text-xl font-semibold tabular-nums">{m.value.toLocaleString("en-US")}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{m.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
          {data?.error ? <p className="mt-2 text-[11px] text-muted-foreground">Some counts are unavailable: {data.error}</p> : null}
        </>
      )}
    </WidgetShell>
  );
}
