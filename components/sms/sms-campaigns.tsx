"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight, Loader2, Megaphone, Plus, RefreshCw, Send, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { cn } from "@/lib/utils";
import { CampaignComposer, RecipientBadge } from "./campaign-composer";

type Campaign = {
  id: string;
  name: string;
  body: string;
  status: "draft" | "scheduled" | "sending" | "done" | "cancelled";
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by_name?: string | null;
  total_count: number;
  queued_count: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  skipped_count: number;
};

type Recipient = { id: string; name: string | null; phone: string; contact_kind: string | null; status: string; error: string | null; sent_at: string | null; delivered_at: string | null };

const STATUS_STYLE: Record<Campaign["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  sending: { label: "Sending", variant: "default" },
  done: { label: "Done", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

/**
 * Bulk SMS campaigns. `variant="strip"` is the compact launcher on the SMS inbox; "full" is the
 * Campaigns page. Both honour ?campaign=new (opens the composer — the dashboard SMS widget
 * links here) and ?campaign=<id> (opens that campaign).
 */
export function SmsCampaigns({ variant = "full" }: { variant?: "full" | "strip" }) {
  const actionToken = useDashboardActionToken();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("campaign");

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setParam = useCallback(
    (value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set("campaign", value);
      else next.delete("campaign");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sms/campaigns?limit=${variant === "strip" ? 5 : 50}`, { headers: { "x-sig-action-token": actionToken } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not load campaigns.");
      setCampaigns(json.campaigns ?? []);
      setNotice(json.available === false ? json.notice : null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load campaigns.");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [actionToken, variant]);

  useEffect(() => { load(); }, [load]);

  // Keep progress moving while anything is sending.
  const anyLive = campaigns?.some((c) => c.status === "sending" || c.status === "scheduled");
  useEffect(() => {
    if (!anyLive) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [anyLive, load]);

  const composerOpen = param === "new";
  const detailId = param && param !== "new" ? param : null;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Megaphone className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-semibold">Bulk campaigns</p>
          <p className="text-xs text-muted-foreground">Text a list, tag or segment — consent and STOP are enforced.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {variant === "strip" ? (
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/sms/campaigns">View all</Link></Button>
        ) : (
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        )}
        <Button size="sm" className="gap-1.5" onClick={() => setParam("new")} disabled={Boolean(notice)}>
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>
    </div>
  );

  const list = (
    <>
      {notice ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" /> {notice}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!campaigns ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        !notice ? <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">No campaigns yet.</p> : null
      ) : (
        <ul className="divide-y rounded-lg border">
          {campaigns.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setParam(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <Badge variant={STATUS_STYLE[c.status].variant} className="shrink-0 text-[10px]">{STATUS_STYLE[c.status].label}</Badge>
                    {c.failed_count ? <Badge variant="destructive" className="shrink-0 text-[10px]">{c.failed_count} failed</Badge> : null}
                  </div>
                  <Progress c={c} />
                  <p className="truncate text-xs text-muted-foreground">
                    {c.status === "scheduled" ? `Sends ${fmt(c.scheduled_at)}` : c.status === "draft" ? `Created ${fmt(c.created_at)}` : `Started ${fmt(c.started_at ?? c.created_at)}`}
                    {c.created_by_name ? ` · ${c.created_by_name}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <>
      {variant === "strip" ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {header}
            {campaigns && campaigns.length ? list : notice ? list : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="space-y-0 pb-3">{header}</CardHeader>
          <CardContent className="space-y-3">{list}</CardContent>
        </Card>
      )}

      <CampaignComposer
        open={composerOpen}
        onOpenChange={(o) => !o && setParam(null)}
        onCreated={(id) => {
          setParam(id);
          void load();
        }}
      />
      <CampaignDetail id={detailId} onClose={() => setParam(null)} onChanged={load} />
    </>
  );
}

function Progress({ c }: { c: Campaign }) {
  const total = Math.max(1, c.total_count);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="bg-primary" style={{ width: pct(c.delivered_count) }} />
        <div className="bg-primary/50" style={{ width: pct(c.sent_count - c.delivered_count) }} />
        <div className="bg-destructive" style={{ width: pct(c.failed_count) }} />
        <div className="bg-muted-foreground/30" style={{ width: pct(c.skipped_count) }} />
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {c.sent_count}/{c.total_count - c.skipped_count} sent · {c.delivered_count} delivered{c.skipped_count ? ` · ${c.skipped_count} skipped` : ""}
      </p>
    </div>
  );
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

function CampaignDetail({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const actionToken = useDashboardActionToken();
  const [data, setData] = useState<{ campaign: Campaign; byStatus: Record<string, number>; recipients: Recipient[]; total: number } | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"launch" | "cancel" | "delete" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const params = new URLSearchParams({ page: String(page) });
    if (filter) params.set("status", filter);
    const res = await fetch(`/api/admin/sms/campaigns/${id}?${params}`, { headers: { "x-sig-action-token": actionToken } });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setData(json);
      setError(null);
    } else setError(json.error ?? "Could not load the campaign.");
  }, [id, page, filter, actionToken]);

  useEffect(() => {
    setData(null);
    setFilter("");
    setPage(1);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const live = data?.campaign.status === "sending";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [live, load]);

  async function act(action: "launch" | "cancel" | "delete") {
    if (!id) return;
    setBusy(action);
    setError(null);
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/admin/sms/campaigns/${id}`, { method: "DELETE", headers: { "x-sig-action-token": actionToken } })
          : await fetch(`/api/admin/sms/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionToken, action }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "That didn't work.");
      setConfirm(null);
      onChanged();
      if (action === "delete") onClose();
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  }

  const c = data?.campaign;
  const counts = data?.byStatus ?? {};
  const countFor = (f: string) =>
    f === "" ? data?.campaign.total_count ?? 0
    : f === "queued" ? (counts.queued ?? 0) + (counts.sending ?? 0)
    : f === "sent" ? (counts.sent ?? 0) + (counts.delivered ?? 0)
    : f === "skipped" ? (counts.skipped_opt_out ?? 0) + (counts.skipped_invalid ?? 0)
    : counts[f] ?? 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / 100)) : 1;

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {!c ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
            <SheetTitle className="sr-only">Campaign</SheetTitle>
            {error ? <span className="text-destructive">{error}</span> : <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</>}
          </div>
        ) : (
          <>
            <SheetHeader className="border-b px-6 pb-4 pt-6 text-left">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_STYLE[c.status].variant} className="text-[10px]">{STATUS_STYLE[c.status].label}</Badge>
                {live ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> sending…</span> : null}
              </div>
              <SheetTitle className="text-xl">{c.name}</SheetTitle>
              <SheetDescription>
                {c.status === "scheduled" ? `Scheduled for ${fmt(c.scheduled_at)}` : c.completed_at ? `Finished ${fmt(c.completed_at)}` : c.started_at ? `Started ${fmt(c.started_at)}` : `Created ${fmt(c.created_at)}`}
              </SheetDescription>
              <div className="pt-1"><Progress c={c} /></div>
              <div className="flex flex-wrap gap-2 pt-2">
                {c.status === "draft" || c.status === "scheduled" ? (
                  <Button size="sm" className="gap-1.5" onClick={() => setConfirm("launch")} disabled={Boolean(busy)}><Send className="h-3.5 w-3.5" /> Send now</Button>
                ) : null}
                {c.status === "draft" || c.status === "scheduled" || c.status === "sending" ? (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConfirm("cancel")} disabled={Boolean(busy)}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>
                ) : null}
                {c.status !== "sending" && !c.sent_count && !c.failed_count ? (
                  <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirm("delete")} disabled={Boolean(busy)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                ) : null}
              </div>
            </SheetHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">{c.body}</div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => { setFilter(f.value); setPage(1); }}
                    className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", filter === f.value ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {f.label} <span className="tabular-nums opacity-80">{countFor(f.value)}</span>
                  </button>
                ))}
              </div>

              {data.recipients.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">No recipients here.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {data.recipients.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{r.name ?? r.phone}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{r.phone}</span>
                          {r.error ? <span className="text-destructive/90"> · {r.error}</span> : r.delivered_at ? ` · delivered ${fmt(r.delivered_at)}` : r.sent_at ? ` · sent ${fmt(r.sent_at)}` : ""}
                        </p>
                      </div>
                      <RecipientBadge status={r.status} title={r.error ?? undefined} />
                    </li>
                  ))}
                </ul>
              )}
              {pages > 1 ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span>Page {page} of {pages}</span>
                  <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              ) : null}
            </div>
          </>
        )}

        <Dialog open={confirm !== null} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirm === "launch" ? `Send to ${c ? c.queued_count : 0} people now?` : confirm === "cancel" ? "Cancel this campaign?" : "Delete this campaign?"}
              </DialogTitle>
              <DialogDescription>
                {confirm === "launch"
                  ? "Texts start going out right away and can't be unsent."
                  : confirm === "cancel"
                    ? "Nothing more will be sent. Texts already sent stay sent."
                    : "The campaign and its recipient list are removed. Nothing has been sent."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={Boolean(busy)}>Keep</Button>
              <Button variant={confirm === "launch" ? "default" : "destructive"} onClick={() => confirm && act(confirm)} disabled={Boolean(busy)} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirm === "launch" ? <Send className="h-4 w-4" /> : confirm === "cancel" ? <CalendarClock className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                {confirm === "launch" ? "Send now" : confirm === "cancel" ? "Cancel campaign" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

