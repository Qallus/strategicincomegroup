"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, Briefcase, Church, Compass, Inbox, Mail, MessageSquare, Phone, Search, Trash2, Users, X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldSelect } from "@/components/ui/field-select";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { DETAIL_LABELS, FORM_TYPES, SUBMISSION_STATUSES, formTypeLabel } from "@/lib/forms/types";
import { cn } from "@/lib/utils";

export type Submission = {
  id: string;
  form_type: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  subject: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  assigned_to: string | null;
  hidden_at: string | null;
  created_at: string;
};

const ICONS: Record<string, LucideIcon> = { compass: Compass, users: Users, church: Church, briefcase: Briefcase, mail: Mail, message: MessageSquare };
const STATUS_CLASS: Record<string, string> = {
  received: "bg-primary/10 text-primary",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  spam: "bg-muted text-muted-foreground line-through",
};

const statusLabel = (s: string) => SUBMISSION_STATUSES.find((x) => x.value === s)?.label ?? s;
const fullName = (r: Submission) => [r.payload?.firstName, r.payload?.lastName].filter(Boolean).join(" ") || r.email || "Unknown";
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};

/** Form Submissions inbox, organised by form type (one tab per website form). */
export function FormInbox({ submissions, staff }: { submissions: Submission[]; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const token = useDashboardActionToken();
  const [rows, setRows] = useState(submissions);
  const [tab, setTab] = useState<string>("all");
  const [status, setStatus] = useState<string>("open");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const r of rows) {
      if (r.status === "done" || r.status === "spam") continue;
      c.all += 1;
      c[r.form_type] = (c[r.form_type] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const types = useMemo(() => {
    const known = Object.keys(FORM_TYPES);
    const extra = [...new Set(rows.map((r) => r.form_type))].filter((t) => !known.includes(t));
    return [...known, ...extra];
  }, [rows]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.form_type !== tab) return false;
      if (status === "open" && (r.status === "done" || r.status === "spam")) return false;
      if (status !== "open" && status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      return [fullName(r), r.email, r.phone, r.subject, r.message, JSON.stringify(r.payload?.details ?? {})]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, tab, status, query]);

  const open = rows.find((r) => r.id === openId) ?? null;

  async function act(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/form-submissions/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sig-action-token": token },
      body: JSON.stringify({ ...body, actionToken: token }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alertError(json.error);
    if (body.action === "delete" || body.action === "remove") {
      setRows((r) => r.filter((x) => x.id !== id));
      setOpenId(null);
    } else if (json.submission) {
      setRows((r) => r.map((x) => (x.id === id ? { ...x, ...json.submission } : x)));
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
        {["all", ...types].map((t) => {
          const meta = (FORM_TYPES as Record<string, { short: string; icon: string }>)[t];
          const Icon = t === "all" ? Inbox : ICONS[meta?.icon ?? "message"] ?? MessageSquare;
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors", on ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <Icon className="h-4 w-4" />
              {t === "all" ? "All forms" : meta?.short ?? formTypeLabel(t)}
              {counts[t] ? <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", on ? "bg-primary text-primary-foreground" : "bg-muted")}>{counts[t]}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, message, details…" />
        </div>
        <div className="w-44">
          <FieldSelect
            value={status}
            onChange={setStatus}
            options={[{ value: "open", label: "Open (new + in progress)" }, { value: "all", label: "All statuses" }, ...SUBMISSION_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
          />
        </div>
      </div>

      {tab !== "all" && (FORM_TYPES as Record<string, { description: string }>)[tab] ? (
        <p className="text-sm text-muted-foreground">{(FORM_TYPES as Record<string, { description: string }>)[tab].description}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
            <Inbox className="mb-3 h-8 w-8" />
            Nothing here yet. Submissions from the website’s contact page and newsletter land in this inbox.
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((r) => {
              const meta = (FORM_TYPES as Record<string, { icon: string }>)[r.form_type];
              const Icon = ICONS[meta?.icon ?? "message"] ?? MessageSquare;
              return (
                <li key={r.id}>
                  <button onClick={() => setOpenId(r.id)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40", openId === r.id && "bg-muted/60")}>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background text-primary"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("truncate text-sm", r.status === "received" ? "font-semibold" : "font-medium")}>{fullName(r)}</span>
                        <span className="text-[11px] text-muted-foreground">{formTypeLabel(r.form_type)}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CLASS[r.status] ?? "bg-muted")}>{statusLabel(r.status)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {r.message || (r.payload?.details ? Object.values(r.payload.details as Record<string, string>).filter(Boolean).join(" · ") : r.email)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{ago(r.created_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {open ? <SubmissionDrawer row={open} staff={staff} onClose={() => setOpenId(null)} onAct={(b) => act(open.id, b)} /> : null}
    </div>
  );
}

function SubmissionDrawer({ row, staff, onClose, onAct }: {
  row: Submission; staff: { id: string; name: string }[]; onClose: () => void; onAct: (body: Record<string, unknown>) => void;
}) {
  const details = (row.payload?.details ?? {}) as Record<string, string>;
  const p = row.payload ?? {};
  const facts: [string, unknown][] = [
    ["Email", row.email],
    ["Phone", row.phone],
    ["Office", p.office],
    ...Object.entries(details).map(([k, v]) => [DETAIL_LABELS[k] ?? k, v] as [string, unknown]),
    ["Source", row.source],
    ["Received", new Date(row.created_at).toLocaleString()],
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{formTypeLabel(row.form_type)}</p>
            <h2 className="mt-1 text-xl font-semibold">{fullName(row)}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 border-b p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <FieldSelect value={row.status} onChange={(v) => onAct({ action: "status", status: v })} options={SUBMISSION_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assigned to</label>
            <FieldSelect value={row.assigned_to ?? ""} onChange={(v) => onAct({ action: "assign", assignedTo: v || null })} options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
        </div>
        <dl className="grid gap-3 border-b p-5 text-sm">
          {facts.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[150px_1fr] gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{String(v)}</dd>
            </div>
          ))}
        </dl>
        <div className="flex-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Message</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{row.message || "No message."}</p>
        </div>
        <div className="flex flex-wrap gap-2 border-t p-5">
          {row.email ? (
            <Button asChild size="sm"><a href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: ${row.subject ?? formTypeLabel(row.form_type)}`)}`}><Mail className="h-4 w-4" /> Reply</a></Button>
          ) : null}
          {row.phone ? <Button asChild size="sm" variant="outline"><a href={`tel:${row.phone}`}><Phone className="h-4 w-4" /> Call</a></Button> : null}
          <Button size="sm" variant="outline" onClick={() => onAct({ action: "status", status: "done" })}>Mark done</Button>
          <Button size="sm" variant="ghost" className="ml-auto" title="Archive" onClick={() => onAct({ action: "remove" })}><Archive className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" title="Delete" onClick={() => window.confirm("Delete this submission?") && onAct({ action: "delete" })}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </aside>
    </div>
  );
}

function alertError(message?: string) {
  window.alert(message || "That action failed.");
}
