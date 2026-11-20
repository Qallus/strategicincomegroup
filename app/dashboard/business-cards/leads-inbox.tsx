"use client";

import * as React from "react";
import {
  Archive, Check, CheckCircle2, CircleDot, ExternalLink, Inbox, Loader2, Mail, Phone, PhoneCall, RefreshCw, Sparkles, Trash2, UserPlus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/field-select";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { cn } from "@/lib/utils";
import type { BusinessCardLead, LeadStatus } from "@/lib/business-cards/types";

// The convert route only creates CRM contacts, and the contacts table only allows
// type "contact" or "lead" (DB check constraint).
const CONTACT_TYPES: [string, string][] = [
  ["lead", "Lead"],
  ["contact", "Contact"],
];

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "archived"];

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-primary/15 text-primary",
  contacted: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  qualified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const leadName = (l: BusinessCardLead) => l.name || l.email || l.phone || "—";
const cardLabel = (l: BusinessCardLead) => l.card?.display_name || l.card?.card_name || "—";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusPill({ status }: { status: LeadStatus }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", STATUS_STYLE[status])}>{status}</span>;
}

export function LeadsInbox({ isAdmin, scope, actionToken, onChanged }: { isAdmin: boolean; scope: "mine" | "all"; actionToken: string; onChanged?: () => void }) {
  const [leads, setLeads] = React.useState<BusinessCardLead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [convertLead, setConvertLead] = React.useState<BusinessCardLead | null>(null);
  const showOwner = isAdmin && scope === "all";

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-cards/leads${isAdmin && scope === "all" ? "?scope=all" : ""}`, { headers: { "x-sig-action-token": actionToken } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load leads.");
      setLeads(json.leads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, scope, actionToken]);

  React.useEffect(() => { load(); }, [load]);

  async function call(lead: BusinessCardLead, method: "PATCH" | "DELETE", body: Record<string, unknown> = {}) {
    const res = await fetch(`/api/business-cards/leads/${lead.id}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, actionToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "That didn't work.");
  }

  async function setStatus(list: BusinessCardLead[], status: LeadStatus) {
    const ids = new Set(list.map((l) => l.id));
    setLeads((prev) => prev.map((l) => (ids.has(l.id) ? { ...l, status } : l)));
    try {
      await Promise.all(list.filter((l) => l.status !== status).map((l) => call(l, "PATCH", { status })));
    } catch (e) {
      void load();
      throw e;
    } finally {
      onChanged?.();
    }
  }

  async function remove(list: BusinessCardLead[]) {
    if (!window.confirm(list.length === 1 ? "Delete this lead?" : `Delete ${list.length} leads?`)) return false;
    const ids = new Set(list.map((l) => l.id));
    setLeads((prev) => prev.filter((l) => !ids.has(l.id)));
    try {
      await Promise.all(list.map((l) => call(l, "DELETE")));
    } catch (e) {
      void load();
      throw e;
    } finally {
      onChanged?.();
    }
    return true;
  }

  const columns: DataColumn<BusinessCardLead>[] = [
    { id: "name", label: "Contact", required: true, width: 200, cell: (l) => <span className="font-medium">{leadName(l)}</span>, sort: leadName },
    { id: "email", label: "Email", width: 220, cell: (l) => l.email ?? "—", sort: (l) => l.email },
    { id: "phone", label: "Phone", width: 140, cell: (l) => l.phone ?? "—", sort: (l) => l.phone },
    { id: "status", label: "Status", width: 120, cell: (l) => <StatusPill status={l.status} />, sort: (l) => STATUSES.indexOf(l.status), exportValue: (l) => l.status },
    { id: "message", label: "Message", width: 280, cell: (l) => <span className="text-muted-foreground">{l.message || "—"}</span>, exportValue: (l) => l.message },
    { id: "card", label: "Card", width: 170, cell: cardLabel, sort: cardLabel },
    { id: "company", label: "Company", width: 160, cell: (l) => l.company ?? "—", sort: (l) => l.company, defaultHidden: true },
    { id: "owner", label: "Owner", width: 160, cell: (l) => l.owner?.display_name || "—", sort: (l) => l.owner?.display_name, defaultHidden: !showOwner },
    { id: "received", label: "Received", width: 130, cell: (l) => timeAgo(l.created_at), sort: (l) => l.created_at, exportValue: (l) => l.created_at },
  ];

  const cards = Array.from(new Map(leads.map((l) => [l.card_id, cardLabel(l)])).entries());

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <DataView<BusinessCardLead>
        storageKey="business-cards.leads"
        exportName="sig-card-leads"
        noun={["lead", "leads"]}
        defaultView="list"
        loading={loading}
        items={leads}
        getId={(l) => l.id}
        title={leadName}
        subtitle={(l) => [l.email, l.phone, l.company].filter(Boolean).join(" · ") || "No contact details"}
        media={(l) => (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {(leadName(l).trim().charAt(0) || "?").toUpperCase()}
          </span>
        )}
        badge={(l) => <StatusPill status={l.status} />}
        meta={(l) => `${cardLabel(l)} · ${timeAgo(l.created_at)}`}
        columns={columns}
        searchText={(l) => [l.name, l.email, l.phone, l.company, l.message, cardLabel(l), l.owner?.display_name].join(" ")}
        stats={[
          { label: "New", value: leads.filter((l) => l.status === "new").length, icon: Sparkles, hint: "Waiting for follow-up" },
          { label: "Contacted", value: leads.filter((l) => l.status === "contacted").length, icon: PhoneCall },
          { label: "Qualified", value: leads.filter((l) => l.status === "qualified").length, icon: CheckCircle2 },
          { label: "All leads", value: leads.length, icon: Inbox },
        ]}
        filters={[
          { id: "all", label: "All", test: () => true },
          ...STATUSES.map((s) => ({ id: s, label: cap(s), test: (l: BusinessCardLead) => l.status === s })),
        ]}
        selectFilters={[
          { id: "card", label: "Card", options: cards.map(([value, label]) => ({ value, label })), get: (l) => l.card_id },
        ]}
        board={{
          lanes: STATUSES.map((s) => ({ id: s, label: cap(s) })),
          get: (l) => l.status,
          onMove: (l, lane) => setStatus([l], lane as LeadStatus).catch((e) => setError(e instanceof Error ? e.message : "Update failed.")),
        }}
        date={(l) => l.created_at}
        actions={[
          { label: "Contacted", icon: PhoneCall, show: (sel) => sel.some((l) => l.status !== "contacted"), run: (sel) => setStatus(sel, "contacted") },
          { label: "Qualified", icon: CheckCircle2, show: (sel) => sel.some((l) => l.status !== "qualified"), run: (sel) => setStatus(sel, "qualified") },
          { label: "New", icon: CircleDot, show: (sel) => sel.some((l) => l.status !== "new"), run: (sel) => setStatus(sel, "new") },
          { label: "Archive", icon: Archive, show: (sel) => sel.some((l) => l.status !== "archived"), run: (sel) => setStatus(sel, "archived") },
          { label: "Save to…", icon: UserPlus, single: true, run: (sel) => setConvertLead(sel[0]) },
          { label: "Email", icon: Mail, single: true, show: (sel) => Boolean(sel[0]?.email), run: (sel) => void window.open(`mailto:${sel[0].email}`) },
          { label: "Delete", icon: Trash2, destructive: true, run: (sel) => remove(sel) },
        ]}
        toolbar={
          <Button size="sm" variant="outline" className="h-9 w-9 px-0" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        }
        preview={(lead, close) => (
          <div className="space-y-5">
            <div className="grid gap-1.5 sm:max-w-xs">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <FieldSelect
                value={lead.status}
                onChange={(v) => void setStatus([lead], v as LeadStatus).catch((e) => setError(e instanceof Error ? e.message : "Update failed."))}
                options={STATUSES.map((s) => ({ value: s, label: cap(s) }))}
              />
            </div>
            <dl className="grid gap-2.5 rounded-xl border bg-muted/30 p-4 text-sm">
              {(
                [
                  ["Email", lead.email],
                  ["Phone", lead.phone],
                  ["Company", lead.company],
                  ["Prefers", lead.preferred_contact],
                  ["Card", cardLabel(lead)],
                  ["Owner", showOwner ? lead.owner?.display_name ?? null : null],
                  ["Source", lead.source],
                  ["Received", new Date(lead.created_at).toLocaleString()],
                ] as [string, string | null][]
              )
                .filter(([, v]) => v && v !== "—")
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[96px_1fr] gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
            </dl>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Message</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{lead.message || "No message."}</p>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {lead.email ? (
                <Button asChild size="sm"><a href={`mailto:${lead.email}`}><Mail className="h-4 w-4" /> Email</a></Button>
              ) : null}
              {lead.phone ? (
                <Button asChild size="sm" variant="outline"><a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /> Call</a></Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => { close(); setConvertLead(lead); }}><UserPlus className="h-4 w-4" /> Save to…</Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive hover:text-destructive"
                title="Delete"
                aria-label="Delete lead"
                onClick={() => void remove([lead]).then((done) => done && close()).catch((e) => setError(e instanceof Error ? e.message : "Delete failed."))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        empty={
          <span className="flex flex-col items-center gap-2">
            <Mail className="h-8 w-8" />
            <span>No leads yet. When someone taps “Send me your info” on a published card, their details land here.</span>
          </span>
        }
      />

      {convertLead && (
        <ConvertLeadModal
          lead={convertLead}
          actionToken={actionToken}
          onClose={() => setConvertLead(null)}
          onConverted={() => { onChanged?.(); }}
        />
      )}
    </div>
  );
}

function ConvertLeadModal({ lead, actionToken, onClose, onConverted }: { lead: BusinessCardLead; actionToken: string; onClose: () => void; onConverted: () => void }) {
  const [contactType, setContactType] = React.useState("lead");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<{ label: string; href: string } | null>(null);

  async function convert() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/business-cards/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "contact", contactType, actionToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || "Conversion failed.");
      setResult({ label: json.label || "Record", href: json.href || "#" });
      onConverted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Save lead to Contacts</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 break-words rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{lead.name || "—"}</span>
          {lead.email && <> · {lead.email}</>}{lead.phone && <> · {lead.phone}</>}{lead.company && <> · {lead.company}</>}
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved “{result.label}”.
            </div>
            <div className="flex justify-end gap-2">
              <Button asChild size="sm" variant="outline"><a href={result.href}><ExternalLink className="h-3.5 w-3.5" /> Open</a></Button>
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Save as</label>
              <FieldSelect value={contactType} onChange={setContactType} options={CONTACT_TYPES.map(([v, l]) => ({ value: v, label: l }))} />
            </div>

            {error && <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={convert} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Save
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
