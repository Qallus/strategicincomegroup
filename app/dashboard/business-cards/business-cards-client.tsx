"use client";

import * as React from "react";
import {
  Archive, BarChart3, Copy, ExternalLink, Eye, EyeOff, IdCard, Mail, MousePointerClick, Nfc, Pencil,
  QrCode, RefreshCw, Save, Send, Share2, Trash2, UserCog, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldSelect } from "@/components/ui/field-select";
import { cn } from "@/lib/utils";
import { DataView, type DataColumn, type DataStat } from "@/components/dashboard/collection";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import type { BusinessCard, CardStats } from "@/lib/business-cards/types";
import type { StaffOption } from "@/lib/business-cards/data";
import { CardBuilder } from "./card-builder";
import { LeadsInbox } from "./leads-inbox";
import { CardAnalyticsView } from "./card-analytics";

type ApiResponse = {
  cards: BusinessCard[];
  stats: CardStats;
  role: string;
  staffId: string;
  isAdmin: boolean;
  staffOptions: StaffOption[];
};

const STAT_TILES: { key: keyof CardStats; label: string; hint: string; icon: DataStat["icon"] }[] = [
  { key: "products", label: "Cards", hint: "Total cards", icon: IdCard },
  { key: "published", label: "Published", hint: "Live public URLs", icon: Send },
  { key: "views", label: "Views", hint: "Public profile loads", icon: Eye },
  { key: "clicks", label: "Clicks", hint: "Link & button actions", icon: MousePointerClick },
  { key: "nfcReady", label: "NFC ready", hint: "Linked to a tag", icon: Nfc },
  { key: "shares", label: "Shares", hint: "Card shared", icon: Share2 },
  { key: "saves", label: "Saves", hint: "Contacts saved", icon: Save },
  { key: "leads", label: "Leads", hint: "Form submissions", icon: Mail },
];

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://my.strategicincomegroup.com").replace(/\/$/, "");

const cardUrl = (c: BusinessCard) => `${PUBLIC_BASE}/c/${c.slug}`;
const qrSrc = (c: BusinessCard, size: number) => `/api/cards/qr?url=${encodeURIComponent(cardUrl(c))}&size=${size}`;
const cardName = (c: BusinessCard) => c.display_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.card_name;
const statusLabel = (s: BusinessCard["status"]) => (s === "published" ? "Published" : s === "archived" ? "Archived" : s === "unpublished" ? "Unpublished" : "Draft");

function StatusPill({ status }: { status: BusinessCard["status"] }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", status === "published" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
      {statusLabel(status)}
    </span>
  );
}

function CardMedia({ card }: { card: BusinessCard }) {
  return card.profile_photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={card.profile_photo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
      <IdCard className="h-4 w-4" />
    </span>
  );
}

async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        try {
          await fn(item);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Failed.");
        }
      }
    }),
  );
  if (errors.length) throw new Error(`${errors.length} of ${items.length} failed: ${errors[0]}`);
}

export function BusinessCardsClient() {
  const actionToken = useDashboardActionToken();
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<"mine" | "all">("mine");
  const [view, setView] = React.useState<"cards" | "leads">("cards");
  const [editing, setEditing] = React.useState<BusinessCard | "new" | null>(null);
  const [analyticsCard, setAnalyticsCard] = React.useState<BusinessCard | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [reassign, setReassign] = React.useState<BusinessCard[] | null>(null);
  const [owner, setOwner] = React.useState("");
  const [reassignBusy, setReassignBusy] = React.useState(false);
  const [reassignError, setReassignError] = React.useState<string | null>(null);

  const authGet = React.useCallback(
    (url: string) => fetch(url, { headers: { "x-sig-action-token": actionToken } }),
    [actionToken],
  );

  const load = React.useCallback(async (which: "mine" | "all") => {
    setLoading(true);
    setError(null);
    try {
      const res = await authGet(`/api/business-cards${which === "all" ? "?scope=all" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards.");
    } finally {
      setLoading(false);
    }
  }, [authGet]);

  React.useEffect(() => { load(scope); }, [scope, load]);

  const isAdmin = data?.isAdmin ?? false;
  const cards = data?.cards ?? [];

  async function openEdit(card: BusinessCard) {
    const detail = await authGet(`/api/business-cards/detail?id=${card.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setEditing(detail?.card ?? card);
  }

  async function copyLinks(list: BusinessCard[]) {
    try {
      await navigator.clipboard.writeText(list.map(cardUrl).join("\n"));
      setCopied(list.length === 1 ? list[0].id : "many");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      throw new Error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  async function call(card: BusinessCard, method: "PATCH" | "DELETE", body: Record<string, unknown> = {}) {
    const res = await fetch(`/api/business-cards/${card.id}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, actionToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `${card.card_name}: that didn't work.`);
  }

  async function setStatus(list: BusinessCard[], status: BusinessCard["status"]) {
    try {
      await eachLimit(list.filter((c) => c.status !== status), 4, (c) => call(c, "PATCH", { status }));
    } finally {
      void load(scope);
    }
  }

  async function remove(list: BusinessCard[]) {
    const msg = list.length === 1 ? `Delete "${list[0].card_name}"? This cannot be undone.` : `Delete ${list.length} cards? This cannot be undone.`;
    if (!window.confirm(msg)) return false;
    try {
      await eachLimit(list, 4, (c) => call(c, "DELETE"));
    } finally {
      void load(scope);
    }
    return true;
  }

  async function applyReassign() {
    if (!reassign) return;
    setReassignBusy(true);
    setReassignError(null);
    try {
      await eachLimit(reassign, 4, (c) => call(c, "PATCH", { staff_user_id: owner || null }));
      setReassign(null);
    } catch (e) {
      setReassignError(e instanceof Error ? e.message : "Reassign failed.");
    } finally {
      setReassignBusy(false);
      void load(scope);
    }
  }

  if (analyticsCard) {
    return <CardAnalyticsView card={analyticsCard} actionToken={actionToken} onClose={() => setAnalyticsCard(null)} />;
  }

  if (editing) {
    return (
      <CardBuilder
        card={editing === "new" ? null : editing}
        isAdmin={isAdmin}
        actionToken={actionToken}
        staffOptions={data?.staffOptions ?? []}
        currentStaffId={data?.staffId ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(scope); }}
      />
    );
  }

  const ownerName = (c: BusinessCard) => c.owner?.display_name || "Unassigned";
  const owners = Array.from(new Map(cards.map((c) => [c.staff_user_id ?? "", ownerName(c)])).entries());

  const columns: DataColumn<BusinessCard>[] = [
    {
      id: "name", label: "Card", required: true, width: 240, sort: cardName,
      cell: (c) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{cardName(c)}</span>
          {c.card_name !== cardName(c) ? <span className="truncate text-xs text-muted-foreground">{c.card_name}</span> : null}
        </span>
      ),
    },
    { id: "status", label: "Status", width: 120, cell: (c) => <StatusPill status={c.status} />, sort: (c) => statusLabel(c.status) },
    { id: "views", label: "Views", width: 90, align: "right", cell: (c) => c.view_count, sort: (c) => c.view_count },
    { id: "clicks", label: "Clicks", width: 90, align: "right", cell: (c) => c.click_count, sort: (c) => c.click_count },
    { id: "owner", label: "Owner", width: 170, cell: ownerName, sort: ownerName, defaultHidden: scope !== "all" },
    { id: "url", label: "Public URL", width: 280, cell: (c) => <span className="text-muted-foreground">{cardUrl(c).replace(/^https?:\/\//, "")}</span>, sort: cardUrl },
    { id: "title", label: "Job title", width: 180, cell: (c) => c.job_title ?? "—", sort: (c) => c.job_title, defaultHidden: true },
    { id: "nfc", label: "NFC", width: 110, cell: (c) => c.nfc_status || "—", sort: (c) => c.nfc_status, defaultHidden: true },
    { id: "updated", label: "Updated", width: 130, cell: (c) => new Date(c.updated_at).toLocaleDateString(), sort: (c) => c.updated_at, exportValue: (c) => c.updated_at },
  ];

  return (
    <div>
      {/* View tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {(["cards", "leads"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition",
              view === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "cards" ? <IdCard className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {v === "cards" ? "Cards" : "Leads"}
            {v === "leads" && (data?.stats.newLeads ?? 0) > 0 && (
              <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                {(data?.stats.newLeads ?? 0) > 99 ? "99+" : data?.stats.newLeads}
              </span>
            )}
          </button>
        ))}
        {isAdmin && (
          <div className="ml-auto flex shrink-0 items-center self-center rounded-lg border border-border bg-card p-0.5 text-xs">
            <button onClick={() => setScope("mine")} className={cn("rounded-md px-3 py-1.5 font-medium", scope === "mine" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>My cards</button>
            <button onClick={() => setScope("all")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 font-medium", scope === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground")}><Users className="h-3.5 w-3.5" />All staff</button>
          </div>
        )}
      </div>

      {view === "leads" ? (
        <LeadsInbox isAdmin={isAdmin} scope={scope} actionToken={actionToken} onChanged={() => load(scope)} />
      ) : (
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <DataView<BusinessCard>
            storageKey="business-cards"
            exportName="sig-business-cards"
            noun={["card", "cards"]}
            defaultView="cards"
            loading={loading}
            items={cards}
            getId={(c) => c.id}
            title={cardName}
            subtitle={(c) => cardUrl(c).replace(/^https?:\/\//, "")}
            media={(c) => <CardMedia card={c} />}
            badge={(c) => <StatusPill status={c.status} />}
            meta={(c) => (
              <span className="flex items-center gap-3">
                {scope === "all" ? <span>{ownerName(c)}</span> : null}
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.view_count}</span>
                <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" />{c.click_count}</span>
              </span>
            )}
            columns={columns}
            searchText={(c) => [cardName(c), c.card_name, c.slug, c.job_title, c.company_name, c.primary_email, ownerName(c)].join(" ")}
            stats={STAT_TILES.map((t) => ({ label: t.label, value: data ? data.stats[t.key] : "—", hint: t.hint, icon: t.icon }))}
            filters={[
              { id: "all", label: "All", test: () => true },
              { id: "published", label: "Published", test: (c) => c.status === "published" },
              { id: "draft", label: "Drafts", test: (c) => c.status === "draft" || c.status === "unpublished" },
              { id: "archived", label: "Archived", test: (c) => c.status === "archived" },
            ]}
            selectFilters={scope === "all" ? [{ id: "owner", label: "Owner", options: owners.map(([value, label]) => ({ value, label })), get: (c) => c.staff_user_id ?? "" }] : undefined}
            actions={[
              { label: "Edit", icon: Pencil, single: true, run: (sel) => openEdit(sel[0]) },
              { label: "Analytics", icon: BarChart3, single: true, run: (sel) => setAnalyticsCard(sel[0]) },
              { label: copied === "many" ? "Copied!" : "Copy links", icon: Copy, run: (sel) => copyLinks(sel) },
              { label: "Publish", icon: Send, show: (sel) => sel.some((c) => c.status !== "published"), run: (sel) => setStatus(sel, "published") },
              { label: "Unpublish", icon: EyeOff, show: (sel) => sel.some((c) => c.status === "published"), run: (sel) => setStatus(sel, "unpublished") },
              { label: "Archive", icon: Archive, show: (sel) => sel.some((c) => c.status !== "archived"), run: (sel) => setStatus(sel, "archived") },
              ...(isAdmin
                ? [{
                    label: "Reassign", icon: UserCog,
                    run: (sel: BusinessCard[]) => { setReassign(sel); setOwner(sel[0]?.staff_user_id ?? ""); setReassignError(null); },
                  }]
                : []),
              { label: "Delete", icon: Trash2, destructive: true, run: (sel) => remove(sel) },
            ]}
            add={{ label: "Create card", onClick: () => setEditing("new") }}
            toolbar={
              <Button size="sm" variant="outline" className="h-9 w-9 px-0" onClick={() => load(scope)} disabled={loading} title="Refresh" aria-label="Refresh">
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            }
            preview={(card, close) => {
              const url = cardUrl(card);
              const published = card.status === "published";
              return (
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-lg bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrSrc(card, 320)} alt="QR code" className="h-28 w-28" />
                    </div>
                    <dl className="grid min-w-0 flex-1 gap-1.5 text-sm">
                      <div className="flex items-center gap-2"><StatusPill status={card.status} /></div>
                      <a href={url} target="_blank" rel="noreferrer" className="break-all text-xs text-primary hover:underline">{url.replace(/^https?:\/\//, "")}</a>
                      {card.job_title ? <p className="text-muted-foreground">{card.job_title}</p> : null}
                      {scope === "all" || isAdmin ? <p className="text-xs text-muted-foreground">Owner: {ownerName(card)}</p> : null}
                      <p className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{card.view_count} views</span>
                        <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" />{card.click_count} clicks</span>
                      </p>
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-1.5 border-t pt-4">
                    <Button size="sm" onClick={() => { close(); void openEdit(card); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => { close(); setAnalyticsCard(card); }}><BarChart3 className="h-3.5 w-3.5" /> Analytics</Button>
                    <Button size="sm" variant="outline" onClick={() => void copyLinks([card]).catch(() => undefined)}><Copy className="h-3.5 w-3.5" /> {copied === card.id ? "Copied!" : "Copy link"}</Button>
                    {published && (
                      <Button asChild size="sm" variant="outline">
                        <a href={url} target="_blank" rel="noreferrer"><Eye className="h-3.5 w-3.5" /> Public page</a>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <a href={qrSrc(card, 1024)} download={`${card.slug}-qr.png`}><QrCode className="h-3.5 w-3.5" /> QR PNG</a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void setStatus([card], published ? "unpublished" : "published").catch((e) => window.alert(e.message))}>
                      {published ? <EyeOff className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} {published ? "Unpublish" : "Publish"}
                    </Button>
                    {card.status !== "archived" && (
                      <Button size="sm" variant="outline" onClick={() => void setStatus([card], "archived").catch((e) => window.alert(e.message))}><Archive className="h-3.5 w-3.5" /> Archive</Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => void remove([card]).then((done) => done && close()).catch((e) => window.alert(e.message))}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              );
            }}
            empty={
              <span className="flex flex-col items-center gap-2">
                <IdCard className="h-8 w-8" />
                <span>No cards yet. Create a digital business card to get a public QR/NFC profile.</span>
              </span>
            }
          />
        </div>
      )}

      <Dialog open={Boolean(reassign)} onOpenChange={(o) => !o && !reassignBusy && setReassign(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign owner</DialogTitle>
            <DialogDescription>{reassign ? `${reassign.length} card${reassign.length === 1 ? "" : "s"} selected.` : null}</DialogDescription>
          </DialogHeader>
          <FieldSelect
            value={owner}
            onChange={setOwner}
            options={[{ value: "", label: "Unassigned" }, ...(data?.staffOptions ?? []).map((s) => ({ value: s.id, label: s.display_name || s.email || "Unnamed" }))]}
          />
          {reassignError ? <p className="text-sm text-destructive">{reassignError}</p> : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReassign(null)} disabled={reassignBusy}>Cancel</Button>
            <Button onClick={() => void applyReassign()} disabled={reassignBusy}>{reassignBusy ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
