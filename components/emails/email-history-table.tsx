"use client";

import { useMemo } from "react";
import { Archive, ArrowDownLeft, ArrowUpRight, AlertTriangle, EyeOff, Inbox, Link2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { DataView, type DataAction, type DataColumn, type DataStat } from "@/components/dashboard/collection";
import { cn } from "@/lib/utils";

export type EmailHistoryRow = {
  id: string;
  sourceId?: string;
  direction: "Sent" | "Received";
  contact: string | null;
  fromName?: string | null;
  subject: string;
  template?: string;
  status: string;
  date?: string | null;
  error?: string | null;
  snippet?: string | null;
  htmlBody?: string | null;
  textBody?: string | null;
  linkedRecord?: string | null;
  flags?: string[];
};

type Mode = "inbox" | "history";
type MessageAction = "hide" | "remove" | "delete";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const who = (r: EmailHistoryRow) => r.fromName || r.contact || "—";
const linked = (r: EmailHistoryRow) => (r.linkedRecord && r.linkedRecord !== "-" ? r.linkedRecord : null);
const failed = (r: EmailHistoryRow) => Boolean(r.error) || /fail|error|bounce/i.test(r.status);
const replyHref = (r: EmailHistoryRow) => `mailto:${r.contact}?subject=Re: ${encodeURIComponent(r.subject)}`;

function StatusPill({ status }: { status: string }) {
  const tone = /fail|error|bounce/i.test(status)
    ? "bg-red-500/15 text-red-700 dark:text-red-400"
    : /sent|deliver/i.test(status)
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : "bg-muted text-muted-foreground";
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", tone)}>{status}</span>;
}

function DirectionIcon({ row }: { row: EmailHistoryRow }) {
  const Icon = row.direction === "Sent" ? ArrowUpRight : ArrowDownLeft;
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background", row.direction === "Sent" ? "text-primary" : "text-emerald-600 dark:text-emerald-400")}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Email History (sent + received) and Inbox (received) on the shared DataView. Row → message preview sheet. */
export function EmailHistoryTable({ rows, emptyMessage, mode = "history" }: { rows: EmailHistoryRow[]; emptyMessage: string; mode?: Mode }) {
  const actionToken = useDashboardActionToken();

  async function act(list: EmailHistoryRow[], actionName: MessageAction) {
    const targets = list.filter((r) => r.sourceId);
    if (!targets.length) throw new Error("Only received messages can be changed here.");
    if (actionName === "delete" && !window.confirm(targets.length === 1 ? "Soft delete this email message?" : `Soft delete ${targets.length} email messages?`)) return;
    for (const row of targets) {
      const response = await fetch(`/api/admin/email/messages/${row.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-sig-action-token": actionToken },
        body: JSON.stringify({ action: actionName, actionToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Email action failed.");
    }
    window.location.reload();
  }

  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort().map((s) => ({ value: s, label: s })), [rows]);
  const templates = useMemo(
    () => [...new Set(rows.map((r) => r.template).filter((t): t is string => Boolean(t && t !== "-")))].sort().map((t) => ({ value: t, label: t })),
    [rows],
  );

  const columns: DataColumn<EmailHistoryRow>[] = [
    ...(mode === "history"
      ? [{ id: "direction", label: "Direction", width: 120, sort: (r: EmailHistoryRow) => r.direction, cell: (r: EmailHistoryRow) => <span className="font-medium">{r.direction}</span> }]
      : []),
    {
      id: "contact",
      label: mode === "inbox" ? "From" : "Contact",
      required: true,
      width: 230,
      sort: who,
      exportValue: (r) => (r.fromName ? `${r.fromName} <${r.contact ?? ""}>` : r.contact),
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{who(r)}</span>
          {r.fromName ? <span className="block truncate text-xs text-muted-foreground">{r.contact}</span> : null}
        </span>
      ),
    },
    {
      id: "subject",
      label: "Subject",
      width: 320,
      sort: (r) => r.subject,
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{r.subject}</span>
          {r.snippet ? <span className="block truncate text-xs text-muted-foreground">{r.snippet}</span> : null}
        </span>
      ),
    },
    mode === "history"
      ? { id: "template", label: "Template", width: 180, sort: (r) => (r.template && r.template !== "-" ? r.template : null), cell: (r) => r.template ?? "—" }
      : { id: "linked", label: "Linked record", width: 180, sort: linked, cell: (r) => linked(r) ?? "—" },
    { id: "status", label: "Status", width: 120, sort: (r) => r.status, cell: (r) => <StatusPill status={r.status} /> },
    ...(mode === "history"
      ? [{ id: "error", label: "Error", width: 220, sort: (r: EmailHistoryRow) => r.error, cell: (r: EmailHistoryRow) => (r.error ? <span className="text-destructive">{r.error}</span> : "—") }]
      : []),
    { id: "date", label: "Date", width: 180, sort: (r) => r.date, exportValue: (r) => (r.date ? new Date(r.date).toISOString() : ""), cell: (r) => fmt(r.date) },
  ];

  const stats: DataStat[] =
    mode === "history"
      ? [
          { label: "Sent", value: rows.filter((r) => r.direction === "Sent").length, icon: ArrowUpRight },
          { label: "Received", value: rows.filter((r) => r.direction === "Received").length, icon: ArrowDownLeft },
          { label: "Failed", value: rows.filter(failed).length, icon: AlertTriangle, hint: "Errors or bounces" },
        ]
      : [
          { label: "Messages", value: rows.length, icon: Inbox },
          { label: "Linked", value: rows.filter(linked).length, icon: Link2, hint: "Matched to a record" },
          { label: "Last 7 days", value: rows.filter((r) => r.date && Date.now() - new Date(r.date).getTime() < 7 * 864e5).length, icon: Mail },
        ];

  const actions: DataAction<EmailHistoryRow>[] = [
    { label: "Reply", icon: Mail, single: true, show: (sel) => Boolean(sel[0]?.contact), run: (sel) => window.open(replyHref(sel[0])) },
    ...(mode === "inbox"
      ? [{ label: "Hide", icon: EyeOff, show: (sel: EmailHistoryRow[]) => sel.some((r) => r.sourceId), run: (sel: EmailHistoryRow[]) => act(sel, "hide") }]
      : [{ label: "Remove", icon: Archive, show: (sel: EmailHistoryRow[]) => sel.some((r) => r.sourceId), run: (sel: EmailHistoryRow[]) => act(sel, "remove") }]),
    { label: "Delete", icon: Trash2, destructive: true, show: (sel) => sel.some((r) => r.sourceId), run: (sel) => act(sel, "delete") },
  ];

  return (
    <DataView<EmailHistoryRow>
      storageKey={mode === "inbox" ? "email-inbox" : "email-history"}
      exportName={mode === "inbox" ? "sig-email-inbox" : "sig-email-history"}
      noun={["message", "messages"]}
      defaultView="table"
      items={rows}
      getId={(r) => r.id}
      title={(r) => r.subject}
      subtitle={(r) => `${r.direction === "Sent" ? "To" : "From"} ${who(r)}${r.fromName && r.contact ? ` <${r.contact}>` : ""}`}
      media={(r) => <DirectionIcon row={r} />}
      badge={(r) => <StatusPill status={r.status} />}
      meta={(r) => fmt(r.date)}
      columns={columns}
      searchText={(r) => [r.contact, r.fromName, r.subject, r.snippet, r.template, r.status, r.error, r.linkedRecord, r.direction].join(" ")}
      stats={stats}
      filters={
        mode === "history"
          ? [
              { id: "all", label: "All", test: () => true },
              { id: "sent", label: "Sent", test: (r) => r.direction === "Sent" },
              { id: "received", label: "Received", test: (r) => r.direction === "Received" },
              { id: "failed", label: "Failed", test: failed },
            ]
          : [
              { id: "all", label: "All", test: () => true },
              { id: "linked", label: "Linked", test: (r) => Boolean(linked(r)) },
              { id: "unlinked", label: "Not linked", test: (r) => !linked(r) },
            ]
      }
      selectFilters={[
        { id: "status", label: "Status", options: statuses, get: (r) => r.status },
        ...(mode === "history" && templates.length ? [{ id: "template", label: "Template", options: templates, get: (r: EmailHistoryRow) => r.template }] : []),
      ]}
      date={(r) => r.date}
      actions={actions}
      preview={(r) => <EmailPreview row={r} mode={mode} onAction={(a) => act([r], a)} />}
      empty={emptyMessage}
    />
  );
}

function EmailPreview({ row, mode, onAction }: { row: EmailHistoryRow; mode: Mode; onAction: (action: MessageAction) => Promise<void> }) {
  const facts: [string, string | null | undefined][] = [
    ["Direction", row.direction],
    [row.direction === "Sent" ? "To" : "From", row.fromName ? `${row.fromName} <${row.contact ?? ""}>` : row.contact],
    ["Date", fmt(row.date)],
    ["Status", row.status],
    ["Template", row.template && row.template !== "-" ? row.template : null],
    ["Linked record", linked(row)],
    ["Error", row.error],
  ];
  const run = (a: MessageAction) => void onAction(a).catch((e) => window.alert(e instanceof Error ? e.message : "Email action failed."));
  return (
    <div className="space-y-5">
      <dl className="grid gap-2 rounded-xl border bg-muted/30 p-4 text-sm">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className={cn("break-words", k === "Error" && "text-destructive")}>{v}</dd>
            </div>
          ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        {row.contact ? (
          <Button asChild size="sm">
            <a href={replyHref(row)}>
              <Mail className="h-4 w-4" /> Reply
            </a>
          </Button>
        ) : null}
        {row.sourceId && mode === "inbox" ? (
          <Button size="sm" variant="outline" onClick={() => run("hide")}>
            <EyeOff className="h-4 w-4" /> Hide
          </Button>
        ) : null}
        {row.sourceId && mode === "history" ? (
          <Button size="sm" variant="outline" onClick={() => run("remove")}>
            <Archive className="h-4 w-4" /> Remove
          </Button>
        ) : null}
        {row.sourceId ? (
          <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => run("delete")}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        ) : null}
      </div>
      {row.htmlBody ? (
        <div className="overflow-hidden rounded-md border bg-white">
          <iframe className="h-[60vh] w-full bg-white" sandbox="" srcDoc={row.htmlBody} title="Email message content" />
        </div>
      ) : (
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{row.textBody || row.snippet || "No message body available."}</pre>
      )}
    </div>
  );
}
