"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, Megaphone, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { WhatsNewItem } from "@/lib/dashboard/data/insights";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWidgetData } from "../use-widget-data";
import { useOptionalDashboard } from "../dashboard-context";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, relativeTime, type WidgetProps } from "./shell";

type Data = { items: WhatsNewItem[]; canPost: boolean; unavailable: boolean };

export default function WhatsNewWidget({ widget, def, preview }: WidgetProps) {
  const dash = useOptionalDashboard();
  const token = useDashboardActionToken();
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh, mutate } = useWidgetData<Data>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const [showHidden, setShowHidden] = React.useState(false);
  const [open, setOpen] = React.useState<WhatsNewItem | null>(null);
  const version = dash?.whatsNewVersion ?? 0;

  React.useEffect(() => {
    if (version) refresh();
  }, [version, refresh]);

  const setDismissed = async (item: WhatsNewItem, dismissed: boolean) => {
    mutate((d) => ({ ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, dismissed } : i)) }));
    await fetch("/api/me/dashboard-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sig-action-token": token },
      body: JSON.stringify({ action: "dismiss_whats_new", id: item.id, dismissed, actionToken: token }),
    }).catch(() => refresh());
  };

  const remove = async (item: WhatsNewItem) => {
    mutate((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }));
    setOpen(null);
    await fetch(`/api/dashboard/whats-new?id=${item.id}`, { method: "DELETE", headers: { "x-sig-action-token": token } }).catch(() => refresh());
  };

  const all = data?.items ?? [];
  const visible = all.filter((i) => showHidden || !i.dismissed);
  const hiddenCount = all.filter((i) => i.dismissed).length;
  const wide = widget.size === "l";

  return (
    <WidgetShell
      icon={def.icon}
      title={def.title}
      subtitle={data && !data.unavailable ? `${all.length - hiddenCount} update${all.length - hiddenCount === 1 ? "" : "s"}` : undefined}
      actions={
        <>
          {hiddenCount > 0 && !preview ? (
            <button type="button" onClick={() => setShowHidden((v) => !v)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {showHidden ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              {showHidden ? "Hide hidden" : `${hiddenCount} hidden`}
            </button>
          ) : null}
          {data?.canPost && !preview ? (
            <button type="button" onClick={() => dash?.openPostUpdate()} className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-gold/15 px-2 text-[11px] font-semibold text-[hsl(30_55%_35%)] hover:bg-brand-gold/25 dark:text-brand-gold">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Post update
            </button>
          ) : null}
        </>
      }
    >
      {loading && !data ? (
        <WidgetSkeleton lines={3} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : data?.unavailable ? (
        <WidgetEmpty icon={Sparkles}>Updates appear here once the dashboard migration has been applied.</WidgetEmpty>
      ) : !visible.length ? (
        <WidgetEmpty icon={Megaphone}>{all.length ? "You've hidden every update." : "No updates yet."}</WidgetEmpty>
      ) : (
        <ul className={cn("grid gap-2.5", wide ? "sm:grid-cols-2 xl:grid-cols-3" : "")}>
          {visible.slice(0, wide ? 6 : 3).map((item) => (
            <li key={item.id} className={cn("group relative overflow-hidden rounded-xl border border-border/70 bg-background/60 transition hover:border-brand-gold/50", item.dismissed && "opacity-60")}>
              <button type="button" disabled={preview} onClick={() => setOpen(item)} className="flex w-full items-stretch gap-3 p-3 text-left">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-navy to-brand-sky text-white dark:from-brand-gold/80 dark:to-brand-gold/30 dark:text-brand-navy-deep">
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{relativeTime(item.publishedAt)}</span>
                  <span className="mt-0.5 line-clamp-1 block text-[13px] font-semibold">{item.title}</span>
                  <span className="line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>
                </span>
              </button>
              {!preview ? (
                <button
                  type="button"
                  onClick={() => void setDismissed(item, !item.dismissed)}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={item.dismissed ? `Show "${item.title}"` : `Hide "${item.title}"`}
                  title={item.dismissed ? "Show" : "Hide"}
                >
                  {item.dismissed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={Boolean(open)} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {open ? (
            <>
              {open.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.imageUrl} alt="" className="-mx-6 -mt-6 mb-1 h-48 w-[calc(100%+3rem)] max-w-none rounded-t-lg object-cover" />
              ) : null}
              <DialogHeader>
                <DialogTitle>{open.title}</DialogTitle>
                <DialogDescription>{new Date(open.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</DialogDescription>
              </DialogHeader>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{open.body}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex gap-2">
                  {open.link ? (
                    <Link href={open.link} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      Learn more <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  ) : null}
                  <button type="button" onClick={() => { void setDismissed(open, !open.dismissed); setOpen(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-muted">
                    {open.dismissed ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
                    {open.dismissed ? "Show again" : "Hide"}
                  </button>
                </div>
                {data?.canPost ? (
                  <button type="button" onClick={() => void remove(open)} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </WidgetShell>
  );
}
