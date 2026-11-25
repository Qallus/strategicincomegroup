"use client";

import * as React from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, relativeTime, type WidgetProps } from "./shell";

type Data = {
  unread: number;
  activeConversations: number;
  awaitingReply: number;
  recent: { id: string; name: string; preview: string | null; at: string | null; unread: number }[];
};

export default function DirectMessagesWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<Data>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  return (
    <WidgetShell icon={def.icon} title={def.title} href="/dashboard/direct-messages" hrefLabel="Messages">
      {loading && !data ? (
        <WidgetSkeleton lines={4} />
      ) : error || !data ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Unread", value: data.unread, hot: data.unread > 0 },
              { label: "Open", value: data.activeConversations, hot: false },
              { label: "Awaiting you", value: data.awaitingReply, hot: data.awaitingReply > 0 },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-xl border border-border/70 bg-background/60 px-2.5 py-2", s.hot && "border-brand-gold/50 bg-brand-gold/[0.07]")}>
                <p className="truncate text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-xl font-semibold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          {data.recent.length ? (
            <ul className="space-y-0.5">
              {data.recent.map((c) => (
                <li key={c.id}>
                  <Link href="/dashboard/direct-messages" className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs transition hover:bg-muted/60">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-[11px] font-semibold text-brand-navy dark:bg-brand-gold/15 dark:text-brand-gold">
                      {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", c.unread ? "font-semibold" : "font-medium")}>{c.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{c.preview ?? "No messages yet"}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(c.at)}</span>
                    {c.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-gold" aria-label={`${c.unread} unread`} /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <WidgetEmpty icon={MessagesSquare}>No conversations yet.</WidgetEmpty>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
