"use client";

import * as React from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, Bell, BellOff, CheckCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { Feed, FeedItem } from "@/lib/notifications/feed";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, relativeTime, useNow, type WidgetProps } from "./shell";

const SEVERITY = {
  critical: { icon: AlertOctagon, cls: "bg-red-500/10 text-red-600 dark:text-red-400", ring: "ring-red-500/30", label: "Critical" },
  warning: { icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", ring: "ring-amber-500/30", label: "Warning" },
  info: { icon: Info, cls: "bg-brand-sky/15 text-brand-sky", ring: "ring-brand-sky/30", label: "Info" },
} as const;

async function post(token: string, body: Record<string, unknown>) {
  const res = await fetch("/api/me/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sig-action-token": token },
    body: JSON.stringify({ ...body, actionToken: token }),
  });
  return res.ok;
}

export function FeedList({ widget, def, preview, alerts }: WidgetProps & { alerts?: boolean }) {
  const token = useDashboardActionToken();
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh, mutate } = useWidgetData<Feed>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const now = useNow(60_000);

  const setRead = (ids: string[] | "all", read: boolean) => {
    mutate((d) => ({
      ...d,
      items: d.items.map((i) => (ids === "all" || ids.includes(i.id) ? { ...i, read } : i)),
      unread: ids === "all" ? 0 : Math.max(0, d.unread + (read ? -ids.length : ids.length)),
    }));
    void post(token, ids === "all" ? { action: "mark_all_read" } : { action: read ? "mark_read" : "mark_unread", ids }).then((ok) => !ok && refresh());
  };

  const items = data?.items ?? [];
  return (
    <WidgetShell
      icon={def.icon}
      title={def.title}
      tone={alerts ? "red" : "gold"}
      subtitle={data ? (data.unread ? `${data.unread} unread` : "All caught up") : undefined}
      actions={
        data && data.unread > 0 && !preview ? (
          <button
            type="button"
            onClick={() => setRead("all", true)}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
          </button>
        ) : null
      }
    >
      {loading && !data ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : alerts && data && !data.alertsReady ? (
        <WidgetEmpty icon={TriangleAlert}>Alerts appear here once the dashboard migration has been applied.</WidgetEmpty>
      ) : !items.length ? (
        <WidgetEmpty icon={alerts ? TriangleAlert : BellOff}>{alerts ? "No alerts. Everything looks healthy." : "No notifications yet."}</WidgetEmpty>
      ) : (
        <ul className="-mx-1 max-h-[17rem] space-y-1 overflow-y-auto pr-1 sig-noscroll">
          {items.map((n) => (
            <FeedRow key={n.id} n={n} now={now} preview={preview} onToggle={() => setRead([n.id], !n.read)} />
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function FeedRow({ n, now, preview, onToggle }: { n: FeedItem; now: number; preview?: boolean; onToggle: () => void }) {
  const sev = n.severity ? SEVERITY[n.severity] : null;
  const Icon = sev?.icon ?? Bell;
  const content = (
    <>
      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", sev ? sev.cls : "bg-muted text-muted-foreground")}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13px]", n.read ? "font-normal text-muted-foreground" : "font-semibold")}>{n.title}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{n.message}</span>
        <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {relativeTime(n.createdAt, now)}
          {n.category ? ` · ${n.category}` : ""}
        </span>
      </span>
    </>
  );
  return (
    <li className={cn("group relative flex items-start gap-2.5 rounded-xl px-2 py-2 transition hover:bg-muted/60", !n.read && "bg-brand-gold/[0.06]")}>
      {n.href && !preview ? (
        <Link href={n.href} className="flex min-w-0 flex-1 items-start gap-2.5" onClick={() => !n.read && onToggle()}>
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-2.5">{content}</div>
      )}
      {!preview ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-70 transition hover:bg-background hover:text-foreground group-hover:opacity-100"
          aria-label={n.read ? `Mark "${n.title}" unread` : `Mark "${n.title}" read`}
          title={n.read ? "Mark unread" : "Mark read"}
        >
          <span className={cn("h-2 w-2 rounded-full", n.read ? "border border-muted-foreground/50" : "bg-brand-gold")} />
        </button>
      ) : null}
    </li>
  );
}

export default function NotificationsWidget(props: WidgetProps) {
  return <FeedList {...props} />;
}
