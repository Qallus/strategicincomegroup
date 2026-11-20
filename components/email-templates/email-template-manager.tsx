"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive, CheckCircle2, Copy, Eye, FilePen, FileText, FlaskConical, Pencil, Send, Trash2, Workflow, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { EMAIL_EVENT_KEYS } from "@/lib/email/constants";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { cn } from "@/lib/utils";
import { FieldSelect } from "@/components/ui/field-select";

type EmailTemplateRow = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  category: string;
  status: "draft" | "active" | "archived";
  html_body: string;
  text_body: string | null;
  available_fields: string[] | null;
  is_test?: boolean | null;
};

type MappingRow = {
  event_key: string;
  template_id: string | null;
  enabled: boolean | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  six_week_challenge: "The 6 Week Challenge",
  six_week_challenge_participant: "6WC · Participant",
  six_week_challenge_facilitator: "6WC · Facilitator",
  general: "General",
  new_user_signup: "New User Sign-Up",
  login: "Login / Auth",
  participants: "Participants",
  waves: "Waves",
  check_in_results: "Check-In Results",
  surveys: "Surveys",
  pastor_elder_review: "Pastor/Elder Review",
  inner_circle: "Inner Circle",
  email_journey: "7-Day Journey",
  notifications: "Notifications",
  blog_posts: "Blog Posts",
};
const CATEGORY_ORDER = [
  "six_week_challenge", "six_week_challenge_participant", "six_week_challenge_facilitator",
  "email_journey", "surveys", "inner_circle", "new_user_signup", "login",
  "participants", "waves", "check_in_results", "pastor_elder_review", "notifications",
  "blog_posts", "general",
];

const catLabel = (c: string) => CATEGORY_LABELS[c] ?? c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const catOf = (t: EmailTemplateRow) => t.category || "general";
const EVENT_LABEL = new Map<string, string>(EMAIL_EVENT_KEYS.map((e) => [e.key, e.label]));
const STATUS_LANES = [
  { id: "active", label: "Live" },
  { id: "draft", label: "Drafts" },
  { id: "archived", label: "Archived" },
];

type Automation = { key: string; label: string; enabled: boolean };

function TestBadge() {
  return (
    <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
      <FlaskConical className="mr-1 h-3 w-3" />Test
    </Badge>
  );
}

function AutomationPills({ autos }: { autos: Automation[] }) {
  if (!autos.length) return <span className="text-xs text-muted-foreground">— Manual</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {autos.map((a) => (
        <span
          key={a.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            a.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground",
          )}
          title={a.enabled ? "Automation active" : "Automation inactive"}
        >
          <Zap className="h-3 w-3" />
          {a.label} · {a.enabled ? "Active" : "Inactive"}
        </span>
      ))}
    </span>
  );
}

export function EmailTemplateManager({ templates, mappings, defaultEmail = "" }: { templates: EmailTemplateRow[]; mappings: MappingRow[]; defaultEmail?: string }) {
  const actionToken = useDashboardActionToken();
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateRow | null>(null);
  const [automationDialog, setAutomationDialog] = useState<{ presetTemplateId?: string } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // template_id -> [{ key, label, enabled }]
  const automationsByTemplate = useMemo(() => {
    const map = new Map<string, Automation[]>();
    for (const m of mappings) {
      if (!m.template_id) continue;
      const label = EVENT_LABEL.get(m.event_key) ?? m.event_key;
      const arr = map.get(m.template_id) ?? [];
      arr.push({ key: m.event_key, label, enabled: m.enabled !== false });
      map.set(m.template_id, arr);
    }
    return map;
  }, [mappings]);
  const autosFor = (t: EmailTemplateRow) => automationsByTemplate.get(t.id) ?? [];

  const categories = useMemo(() => {
    const present = new Set(templates.map(catOf));
    // Always show the 6-Week Challenge tags (program is being prepared).
    present.add("six_week_challenge");
    present.add("six_week_challenge_participant");
    present.add("six_week_challenge_facilitator");
    return CATEGORY_ORDER.filter((c) => present.has(c)).concat([...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort());
  }, [templates]);

  async function post(url: string, body: Record<string, unknown>, method = "POST") {
    setActionMessage(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-sig-action-token": actionToken },
      body: JSON.stringify({ ...body, actionToken }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? "Action failed.");
    return payload;
  }

  const saveBody = (t: EmailTemplateRow, patch: Partial<{ status: EmailTemplateRow["status"]; isTest: boolean }>) => ({
    id: t.id, name: t.name, subject: t.subject, category: t.category,
    status: patch.status ?? t.status, htmlBody: t.html_body, textBody: t.text_body,
    ...(patch.isTest !== undefined ? { isTest: patch.isTest } : {}),
  });

  // Bulk actions run per template, then reload once (the server page re-reads templates + mappings).
  async function each(list: EmailTemplateRow[], fn: (t: EmailTemplateRow) => Promise<unknown>) {
    for (const t of list) await fn(t);
    window.location.reload();
  }

  const duplicate = (list: EmailTemplateRow[]) =>
    each(list, (t) =>
      post("/api/admin/email/templates", {
        name: `${t.name} Copy`, subject: t.subject, category: t.category,
        status: "draft", htmlBody: t.html_body, textBody: t.text_body,
      }),
    );
  const setStatus = (list: EmailTemplateRow[], status: EmailTemplateRow["status"]) =>
    each(list.filter((t) => t.status !== status), (t) => post("/api/admin/email/templates", saveBody(t, { status })));
  const setTest = (list: EmailTemplateRow[], isTest: boolean) => each(list, (t) => post("/api/admin/email/templates", saveBody(t, { isTest })));

  async function remove(list: EmailTemplateRow[]) {
    const what = list.length === 1 ? `the template “${list[0].name}”` : `${list.length} templates`;
    if (!window.confirm(`Permanently delete ${what}? This cannot be undone.`)) return;
    await each(list, (t) => post("/api/admin/email/templates", { id: t.id }, "DELETE"));
  }

  async function sendTest(t: EmailTemplateRow) {
    const payload = await post("/api/admin/email/templates/test-send", { templateId: t.id });
    setActionMessage(`Test email sent to ${payload.to}.`);
  }

  const columns: DataColumn<EmailTemplateRow>[] = [
    {
      id: "name",
      label: "Name",
      required: true,
      width: 260,
      sort: (t) => t.name,
      cell: (t) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{t.name}</span>
          {t.is_test ? <TestBadge /> : null}
        </span>
      ),
    },
    { id: "subject", label: "Subject", width: 300, sort: (t) => t.subject, cell: (t) => <span className="text-muted-foreground">{t.subject}</span> },
    { id: "category", label: "Category", width: 190, sort: (t) => catLabel(catOf(t)), cell: (t) => <Badge variant="secondary" className="whitespace-nowrap">{catLabel(catOf(t))}</Badge> },
    {
      id: "automation",
      label: "Automation",
      width: 260,
      sort: (t) => autosFor(t).map((a) => a.label).join(", ") || null,
      cell: (t) => <AutomationPills autos={autosFor(t)} />,
    },
    { id: "status", label: "Status", width: 120, sort: (t) => t.status, cell: (t) => <StatusPill status={t.status} /> },
    { id: "test", label: "Test", width: 90, defaultHidden: true, sort: (t) => (t.is_test ? "Yes" : "No"), cell: (t) => (t.is_test ? "Yes" : "—") },
    { id: "slug", label: "Slug", width: 220, defaultHidden: true, sort: (t) => t.slug, cell: (t) => <span className="font-mono text-xs text-muted-foreground">{t.slug}</span> },
    { id: "fields", label: "Merge fields", width: 240, defaultHidden: true, exportValue: (t) => (t.available_fields ?? []).join("; "), cell: (t) => (t.available_fields ?? []).join(", ") || "—" },
  ];

  return (
    <div className="space-y-4">
      <DataView<EmailTemplateRow>
        storageKey="email-templates"
        exportName="sig-email-templates"
        noun={["template", "templates"]}
        defaultView="table"
        items={templates}
        getId={(t) => t.id}
        title={(t) => t.name}
        subtitle={(t) => t.subject}
        badge={(t) => (
          <span className="flex shrink-0 items-center gap-1">
            {t.is_test ? <TestBadge /> : null}
            <StatusPill status={t.status} />
          </span>
        )}
        meta={(t) => catLabel(catOf(t))}
        columns={columns}
        searchText={(t) => `${t.name} ${t.subject} ${t.category} ${catLabel(catOf(t))} ${t.status} ${autosFor(t).map((a) => a.label).join(" ")}`}
        stats={[
          { label: "Templates", value: templates.length, icon: FileText },
          { label: "Live", value: templates.filter((t) => t.status === "active").length, icon: CheckCircle2 },
          { label: "Drafts", value: templates.filter((t) => t.status === "draft").length, icon: FilePen },
          { label: "Automated", value: templates.filter((t) => autosFor(t).length).length, icon: Zap, hint: "Power an automation" },
          { label: "Test", value: templates.filter((t) => t.is_test).length, icon: FlaskConical },
        ]}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "live", label: "Live", test: (t) => t.status === "active" },
          { id: "draft", label: "Drafts", test: (t) => t.status === "draft" },
          { id: "test", label: "Test", test: (t) => Boolean(t.is_test) },
          { id: "archived", label: "Archived", test: (t) => t.status === "archived" },
        ]}
        selectFilters={[
          { id: "category", label: "Category", options: categories.map((c) => ({ value: c, label: catLabel(c) })), get: catOf },
          {
            id: "automation",
            label: "Automation",
            options: [{ value: "__manual", label: "Manual (none)" }, ...EMAIL_EVENT_KEYS.map((e) => ({ value: e.key, label: e.label }))],
            get: (t) => (autosFor(t).length ? autosFor(t).map((a) => a.key) : "__manual"),
          },
        ]}
        board={{
          lanes: STATUS_LANES,
          get: (t) => t.status,
          onMove: (t, lane) => setStatus([t], lane as EmailTemplateRow["status"]).catch((e) => window.alert(e instanceof Error ? e.message : "Could not update template.")),
        }}
        onOpen={setPreviewTemplate}
        add={{ label: "Create template", onClick: () => window.location.assign("/dashboard/emails/editor") }}
        toolbar={
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/dashboard/emails/automations" title="Manage automations">
              <Zap className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Automations</span>
            </Link>
          </Button>
        }
        actions={[
          { label: "Preview", icon: Eye, single: true, run: (sel) => setPreviewTemplate(sel[0]) },
          { label: "Edit", icon: Pencil, single: true, run: (sel) => window.location.assign(`/dashboard/emails/editor?id=${sel[0].id}`) },
          { label: "Add to automation", icon: Workflow, single: true, run: (sel) => setAutomationDialog({ presetTemplateId: sel[0].id }) },
          { label: "Send test to me", icon: Send, single: true, show: (sel) => sel[0]?.status !== "archived", run: (sel) => sendTest(sel[0]) },
          { label: "Duplicate as draft", icon: Copy, run: duplicate },
          { label: "Mark as test", icon: FlaskConical, show: (sel) => sel.some((t) => !t.is_test), run: (sel) => setTest(sel.filter((t) => !t.is_test), true) },
          { label: "Unmark test", icon: FlaskConical, show: (sel) => sel.some((t) => t.is_test), run: (sel) => setTest(sel.filter((t) => t.is_test), false) },
          { label: "Archive", icon: Archive, show: (sel) => sel.some((t) => t.status !== "archived"), run: (sel) => setStatus(sel, "archived") },
          { label: "Delete", icon: Trash2, destructive: true, run: remove },
        ]}
        empty="No templates yet. Create one in the email editor."
      />

      {actionMessage ? <p role="status" className="text-sm text-primary">{actionMessage}</p> : null}

      {/* Add-to-automation dialog */}
      {automationDialog ? (
        <AddAutomationDialog
          templates={templates}
          mappings={mappings}
          presetTemplateId={automationDialog.presetTemplateId}
          actionToken={actionToken}
          onClose={() => setAutomationDialog(null)}
        />
      ) : null}

      {/* Preview (row click) */}
      {previewTemplate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3" role="dialog" aria-modal="true">
          <div className="flex h-[92vh] w-full max-w-[92rem] flex-col overflow-hidden rounded-md border bg-background shadow-xl">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{previewTemplate.name}</p>
                <p className="truncate text-xs text-muted-foreground">{previewTemplate.subject}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/emails/editor?id=${previewTemplate.id}`}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewTemplate(null)}>Close</Button>
            </div>
            <div className="flex-1 overflow-auto bg-muted p-3">
              <div className="mx-auto w-full max-w-[86rem] overflow-hidden rounded-md border bg-white shadow-sm">
                <iframe className="h-[80vh] w-full bg-white" sandbox="" srcDoc={previewTemplate.html_body} title="Email template preview" />
              </div>
            </div>
            {/* Send bar — send this template straight from the preview */}
            <PreviewSendBar key={previewTemplate.id} template={previewTemplate} defaultEmail={defaultEmail} actionToken={actionToken} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Send bar inside the preview modal: fire the previewed template to one or more emails.
// Uses the same test-send endpoint (renders with sample merge data, e.g. {{first_name}} → "there").
function PreviewSendBar({ template, defaultEmail, actionToken }: { template: EmailTemplateRow; defaultEmail: string; actionToken: string }) {
  const [to, setTo] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const emails = to.split(/[,\s;]+/).map((e) => e.trim()).filter(Boolean);
  const allValid = emails.length > 0 && emails.every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  async function send() {
    if (!allValid) { setResult({ ok: false, text: "Enter at least one valid email address." }); return; }
    setSending(true);
    setResult(null);
    const failures: string[] = [];
    for (const email of emails) {
      try {
        const res = await fetch("/api/admin/email/templates/test-send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-sig-action-token": actionToken },
          body: JSON.stringify({ templateId: template.id, to: email, actionToken }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) failures.push(`${email}: ${payload.error ?? "failed"}`);
      } catch {
        failures.push(`${email}: network error`);
      }
    }
    setSending(false);
    if (failures.length === 0) {
      setResult({ ok: true, text: `Sent to ${emails.length} recipient${emails.length === 1 ? "" : "s"}.` });
    } else {
      setResult({ ok: false, text: failures.join("  ·  ") });
    }
  }

  return (
    <div className="border-t bg-card px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Send className="h-4 w-4" /> Send this email
        </span>
        <Input
          value={to}
          onChange={(e) => { setTo(e.target.value); setResult(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !sending) send(); }}
          placeholder="recipient@example.com, another@example.com"
          className="flex-1"
          type="text"
        />
        <Button type="button" onClick={send} disabled={sending || !allValid} className="shrink-0">
          <Send className="h-4 w-4" /> {sending ? "Sending…" : emails.length > 1 ? `Send to ${emails.length}` : "Send"}
        </Button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {result ? (
          <span className={result.ok ? "text-primary" : "text-destructive"}>{result.text}</span>
        ) : (
          <span className="text-muted-foreground">
            Sends the live template with sample values (e.g. <code className="rounded bg-muted px-1">{"{{first_name}}"}</code> → &ldquo;there&rdquo;). Separate multiple emails with commas.
          </span>
        )}
        <Link href="/dashboard/emails/send" className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Deploy to an audience →
        </Link>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: EmailTemplateRow["status"] }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    draft: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", styles[status])}>{status}</span>;
}

function AddAutomationDialog({
  templates, mappings, presetTemplateId, actionToken, onClose,
}: {
  templates: EmailTemplateRow[];
  mappings: MappingRow[];
  presetTemplateId?: string;
  actionToken: string;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(presetTemplateId ?? "");
  const [eventKey, setEventKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentForEvent = mappings.find((m) => m.event_key === eventKey);
  const currentTemplateName = currentForEvent?.template_id
    ? templates.find((t) => t.id === currentForEvent.template_id)?.name ?? "another template"
    : null;

  async function save() {
    setError(null);
    if (!templateId) { setError("Choose a template."); return; }
    if (!eventKey) { setError("Choose an automation."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email/template-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sig-action-token": actionToken },
        body: JSON.stringify({ eventKey, templateId, enabled, actionToken }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Could not save automation.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save automation.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to automation</DialogTitle>
          <DialogDescription>Connect a template to an automated moment. This sets which template that automation sends.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Template</span>
            <FieldSelect
              className="h-10"
              value={templateId}
              onChange={setTemplateId}
              disabled={!!presetTemplateId}
              placeholder="Select a template…"
              options={templates.filter((t) => t.status !== "archived").map((t) => ({ value: t.id, label: t.name }))}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Automation</span>
            <FieldSelect
              className="h-10"
              value={eventKey}
              onChange={setEventKey}
              placeholder="Select an automation…"
              options={EMAIL_EVENT_KEYS.map((ev) => ({ value: ev.key, label: ev.label }))}
            />
          </label>

          {eventKey && currentTemplateName ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              This automation currently sends <strong>{currentTemplateName}</strong>. Saving will replace it with the selected template.
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Automation active" />
            <span className="text-sm">{enabled ? "Active — will send automatically" : "Inactive — connected but paused"}</span>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save automation"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
