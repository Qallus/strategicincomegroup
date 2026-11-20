"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, Briefcase, CheckCircle2, Church, CircleDot, Compass, Inbox, Mail, MessageSquare, Phone, Trash2, Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/field-select";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
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
const details = (r: Submission) => (r.payload?.details ?? {}) as Record<string, string>;
const typeMeta = (t: string) => (FORM_TYPES as Record<string, { short: string; icon: string }>)[t];
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};
const open = (r: Submission) => r.status !== "done" && r.status !== "spam";

function StatusPill({ status }: { status: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CLASS[status] ?? "bg-muted")}>{statusLabel(status)}</span>;
}

function TypeIcon({ type }: { type: string }) {
  const Icon = ICONS[typeMeta(type)?.icon ?? "message"] ?? MessageSquare;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Form Submissions inbox — every website form, organised by form type, on the shared DataView. */
export function FormInbox({ submissions, staff }: { submissions: Submission[]; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const token = useDashboardActionToken();
  const [rows, setRows] = useState(submissions);
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.name ?? null;

  async function act(ids: string[], body: Record<string, unknown>) {
    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/admin/form-submissions/${id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-sig-action-token": token },
          body: JSON.stringify({ ...body, actionToken: token }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "That action failed.");
        return json.submission as Submission | undefined;
      }),
    );
    if (body.action === "delete" || body.action === "remove") setRows((r) => r.filter((x) => !ids.includes(x.id)));
    else setRows((r) => r.map((x) => results.find((s) => s?.id === x.id) ?? x));
    router.refresh();
  }

  const columns: DataColumn<Submission>[] = [
    { id: "name", label: "Name", required: true, width: 220, cell: (r) => <span className="font-medium">{fullName(r)}</span>, sort: fullName },
    { id: "type", label: "Form", width: 170, cell: (r) => formTypeLabel(r.form_type), sort: (r) => formTypeLabel(r.form_type) },
    { id: "status", label: "Status", width: 130, cell: (r) => <StatusPill status={r.status} />, sort: (r) => statusLabel(r.status) },
    { id: "email", label: "Email", width: 240, cell: (r) => r.email ?? "—", sort: (r) => r.email },
    { id: "phone", label: "Phone", width: 150, cell: (r) => r.phone ?? "—", sort: (r) => r.phone },
    { id: "office", label: "Office", width: 170, cell: (r) => String(r.payload?.office ?? "—"), sort: (r) => String(r.payload?.office ?? ""), defaultHidden: true },
    { id: "assigned", label: "Assigned to", width: 160, cell: (r) => staffName(r.assigned_to) ?? "—", sort: (r) => staffName(r.assigned_to) },
    { id: "message", label: "Message", width: 320, cell: (r) => <span className="text-muted-foreground">{r.message ?? "—"}</span>, exportValue: (r) => r.message },
    { id: "received", label: "Received", width: 140, cell: (r) => ago(r.created_at), sort: (r) => r.created_at, exportValue: (r) => new Date(r.created_at).toISOString() },
  ];

  const typeCount = (t: string) => rows.filter((r) => r.form_type === t && open(r)).length;

  return (
    <DataView<Submission>
      storageKey="form-submissions"
      exportName="sig-form-submissions"
      noun={["submission", "submissions"]}
      items={rows}
      getId={(r) => r.id}
      title={fullName}
      subtitle={(r) => `${formTypeLabel(r.form_type)} · ${r.email ?? r.phone ?? "no contact"}`}
      media={(r) => <TypeIcon type={r.form_type} />}
      badge={(r) => <StatusPill status={r.status} />}
      meta={(r) => ago(r.created_at)}
      columns={columns}
      searchText={(r) => [fullName(r), r.email, r.phone, r.subject, r.message, formTypeLabel(r.form_type), JSON.stringify(details(r))].join(" ")}
      stats={[
        { label: "Open", value: rows.filter(open).length, icon: Inbox, hint: "New + in progress" },
        { label: "New clients", value: typeCount("new_client"), icon: Compass },
        { label: "Client service", value: typeCount("client_service"), icon: Users },
        { label: "Churches & 403(b)", value: typeCount("church_403b"), icon: Church },
        { label: "Careers", value: typeCount("career_interest"), icon: Briefcase },
      ]}
      filters={[
        { id: "open", label: "Open", test: open },
        { id: "all", label: "All", test: () => true },
        ...SUBMISSION_STATUSES.map((s) => ({ id: s.value, label: s.label, test: (r: Submission) => r.status === s.value })),
      ]}
      selectFilters={[
        { id: "type", label: "Form", options: Object.entries(FORM_TYPES).map(([value, m]) => ({ value, label: m.label })), get: (r) => r.form_type },
        { id: "assigned", label: "Assigned", options: staff.map((s) => ({ value: s.id, label: s.name })), get: (r) => r.assigned_to },
      ]}
      board={{
        lanes: SUBMISSION_STATUSES.map((s) => ({ id: s.value, label: s.label })),
        get: (r) => r.status,
        onMove: (r, lane) => act([r.id], { action: "status", status: lane }),
      }}
      date={(r) => r.created_at}
      actions={[
        { label: "In progress", icon: CircleDot, run: (sel) => act(sel.map((r) => r.id), { action: "status", status: "in_progress" }) },
        { label: "Mark done", icon: CheckCircle2, run: (sel) => act(sel.map((r) => r.id), { action: "status", status: "done" }) },
        { label: "Reply", icon: Mail, single: true, show: (sel) => Boolean(sel[0]?.email), run: (sel) => window.open(`mailto:${sel[0].email}`) },
        { label: "Archive", icon: Archive, run: (sel) => act(sel.map((r) => r.id), { action: "remove" }) },
        {
          label: "Delete",
          icon: Trash2,
          destructive: true,
          run: (sel) => (window.confirm(`Delete ${sel.length} submission${sel.length === 1 ? "" : "s"}?`) ? act(sel.map((r) => r.id), { action: "delete" }) : undefined),
        },
      ]}
      preview={(r, close) => <SubmissionDetail row={r} staff={staff} onAct={(b) => act([r.id], b).then(() => (b.action === "delete" || b.action === "remove" ? close() : undefined))} />}
      empty="Nothing here yet. Submissions from the website’s contact page and newsletter land in this inbox."
    />
  );
}

function SubmissionDetail({ row, staff, onAct }: { row: Submission; staff: { id: string; name: string }[]; onAct: (body: Record<string, unknown>) => Promise<unknown> }) {
  const p = row.payload ?? {};
  const facts: [string, unknown][] = [
    ["Email", row.email],
    ["Phone", row.phone],
    ["Office", p.office],
    ...Object.entries(details(row)).map(([k, v]) => [DETAIL_LABELS[k] ?? k, v] as [string, unknown]),
    ["Source", row.source],
    ["Received", new Date(row.created_at).toLocaleString()],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <FieldSelect value={row.status} onChange={(v) => void onAct({ action: "status", status: v })} options={SUBMISSION_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Assigned to</label>
          <FieldSelect value={row.assigned_to ?? ""} onChange={(v) => void onAct({ action: "assign", assignedTo: v || null })} options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
        </div>
      </div>
      <dl className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[140px_1fr] gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{String(v)}</dd>
            </div>
          ))}
      </dl>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Message</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{row.message || "No message."}</p>
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {row.email ? (
          <Button asChild size="sm">
            <a href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: ${row.subject ?? formTypeLabel(row.form_type)}`)}`}>
              <Mail className="h-4 w-4" /> Reply
            </a>
          </Button>
        ) : null}
        {row.phone ? (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${row.phone}`}>
              <Phone className="h-4 w-4" /> Call
            </a>
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => void onAct({ action: "status", status: "done" })}>
          Mark done
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" title="Archive" onClick={() => void onAct({ action: "remove" })}>
          <Archive className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" title="Delete" onClick={() => window.confirm("Delete this submission?") && void onAct({ action: "delete" })}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
