"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, formatPhone, relativeTime, useNow, type WidgetProps } from "./shell";

type SmsData = { conversations: { id: string; name: string | null; number: string; at: string | null; preview: string | null; unread: number }[]; unread: number; unavailable: boolean };
type EmailData = { messages: { id: string; subject: string; from: string; snippet: string; at: string | null; unread: boolean }[]; unavailable: boolean };

type Row = { id: string; title: string; preview: string; at: string | null; unread: boolean; badge?: number };

function List({ rows, href, now }: { rows: Row[]; href: string; now: number }) {
  return (
    <ul className="-mx-1 space-y-0.5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={href} className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-muted/60">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", r.unread ? "bg-brand-gold" : "bg-transparent")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-[13px]", r.unread ? "font-semibold" : "font-medium")}>{r.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(r.at, now)}</span>
              </span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{r.preview}</span>
            </span>
            {r.badge ? <span className="mt-1 shrink-0 rounded-full bg-brand-gold px-1.5 text-[10px] font-semibold text-brand-navy-deep">{r.badge}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SmsInboxWidget({ widget, def, preview }: { widget: WidgetProps["widget"]; def: WidgetProps["def"]; preview?: boolean }) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<SmsData>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const now = useNow();
  return (
    <WidgetShell icon={def.icon} title={def.title} subtitle={data ? (data.unread ? `${data.unread} unread` : "All read") : undefined} href="/dashboard/sms" hrefLabel="SMS" tone="sage">
      {loading && !data ? <WidgetSkeleton lines={4} /> : error || !data ? <WidgetError error={error} status={status} onRetry={refresh} /> : !data.conversations.length ? (
        <WidgetEmpty icon={MessagesSquare}>No text conversations yet.</WidgetEmpty>
      ) : (
        <List now={now} href="/dashboard/sms" rows={data.conversations.map((c) => ({ id: c.id, title: c.name || formatPhone(c.number), preview: c.preview ?? "", at: c.at, unread: c.unread > 0, badge: c.unread }))} />
      )}
    </WidgetShell>
  );
}

export function EmailInboxWidget({ widget, def, preview }: { widget: WidgetProps["widget"]; def: WidgetProps["def"]; preview?: boolean }) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<EmailData>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const now = useNow();
  return (
    <WidgetShell icon={def.icon} title={def.title} href="/dashboard/email-inbox" hrefLabel="Inbox" tone="sky">
      {loading && !data ? <WidgetSkeleton lines={4} /> : error || !data ? <WidgetError error={error} status={status} onRetry={refresh} /> : !data.messages.length ? (
        <WidgetEmpty icon={Inbox}>{data.unavailable ? "The inbox isn't synced yet." : "Inbox zero."}</WidgetEmpty>
      ) : (
        <List now={now} href="/dashboard/email-inbox" rows={data.messages.map((m) => ({ id: m.id, title: m.from, preview: `${m.subject} — ${m.snippet}`, at: m.at, unread: m.unread }))} />
      )}
    </WidgetShell>
  );
}

export default function InboxWidget(props: WidgetProps) {
  return props.widget.kind === "email_inbox" ? <EmailInboxWidget {...props} /> : <SmsInboxWidget {...props} />;
}
