"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, KeyRound, Loader2, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest } from "@/lib/dashboard/requests";
import { Input } from "@/components/ui/input";
import { useWidgetData } from "../use-widget-data";
import { WidgetError, WidgetShell, WidgetSkeleton, relativeTime, type WidgetProps } from "./shell";

type Status = { configured: boolean; hasApiKey: boolean; lastTest: { ok: boolean; message: string | null; testedAt: string } | null; sandbox: boolean; canManage: boolean };
type Hit = { id: string; name: string; type: string | null; status: string | null; email: string | null; phone: string | null };

export default function RedtailWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<Status>(req, { refreshMs: preview ? 0 : 5 * 60_000 });
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!data?.configured || q.trim().length < 2) {
      setHits(null);
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      setLookupError(null);
      try {
        const res = await fetch(`/api/dashboard/redtail?q=${encodeURIComponent(q.trim())}`);
        const j = (await res.json().catch(() => ({}))) as { results?: Hit[]; error?: string };
        if (!res.ok) throw new Error(j.error || "Lookup failed.");
        setHits(j.results ?? []);
      } catch (e) {
        setLookupError(e instanceof Error ? e.message : "Lookup failed.");
        setHits(null);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, data?.configured]);

  const healthy = data?.configured && (data.lastTest ? data.lastTest.ok : true);

  return (
    <WidgetShell icon={def.icon} title={def.title} tone="navy" subtitle={data ? (data.configured ? (data.sandbox ? "Connected · sandbox" : "Connected") : "Not connected") : undefined}>
      {loading && !data ? (
        <WidgetSkeleton lines={3} />
      ) : error || !data ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : !data.configured ? (
        <div className="flex h-full flex-col items-start justify-center gap-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Connect Redtail to look up clients from the dashboard.</p>
          <p>{data.hasApiKey ? "An API key is saved — add the user key to finish." : "Add the Redtail API key and user key under Credentials → CRM."}</p>
          {data.canManage ? (
            <Link href="/dashboard/credentials?tab=crm" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-2.5 py-1.5 font-semibold text-white hover:bg-brand-navy/90 dark:bg-brand-gold dark:text-brand-navy-deep">
              <KeyRound className="h-3.5 w-3.5" aria-hidden /> Set up Redtail
            </Link>
          ) : (
            <p>Ask a super admin to connect it.</p>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col gap-2.5">
          <p className={cn("inline-flex items-center gap-1.5 text-[11px]", healthy ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {healthy ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <CircleAlert className="h-3.5 w-3.5" aria-hidden />}
            {data.lastTest ? `${data.lastTest.ok ? "Test passed" : "Last test failed"} ${relativeTime(data.lastTest.testedAt)}` : "Not tested yet"}
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} disabled={preview} placeholder="Look up a client by name" aria-label="Look up a Redtail client" className="h-9 bg-background/70 pl-8" />
            {busy ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
          </div>
          {lookupError ? <p className="text-[11px] text-destructive">{lookupError}</p> : null}
          {hits ? (
            hits.length ? (
              <ul className="max-h-48 space-y-0.5 overflow-y-auto sig-noscroll">
                {hits.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs hover:bg-muted/60">
                    <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{[h.type, h.status, h.email, h.phone].filter(Boolean).join(" · ") || "No details"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">No Redtail clients match “{q}”.</p>
            )
          ) : (
            <p className="text-[11px] text-muted-foreground">Read-only lookup. Results come straight from Redtail.</p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
