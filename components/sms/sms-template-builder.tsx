"use client";

import { useState } from "react";
import { CheckCircle2, FilePen, MessageSquareText, Pencil, Undo2 } from "lucide-react";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { DEFAULT_SMS_FIELDS } from "@/lib/sms/constants";
import { smsSegmentCount, extractSmsFields } from "@/lib/sms/templates";

interface SmsTemplate {
  id: string;
  name: string;
  slug: string;
  body: string;
  category: string;
  status: string;
  available_fields: string[];
  updated_at: string;
}

interface SmsTemplateBuilderProps {
  templates: SmsTemplate[];
}

const SAMPLE_DATA: Record<string, string> = {
  first_name: "Michael",
  last_name: "Smith",
  full_name: "Jordan Smith",
  email: "michael@example.com",
  phone: "+14805550000",
  wave: "Wave 1",
  source: "Direct",
  participant_type: "General Participant",
  check_in_status: "completed",
  survey_status: "survey_sent",
  sms_opt_out_url: "https://strategicincomegroup.com/sms/opt-out",
  site_url: "https://strategicincomegroup.com",
};

export function SmsTemplateBuilder({ templates: initialTemplates }: SmsTemplateBuilderProps) {
  const token = useDashboardActionToken();
  const [templates, setTemplates] = useState<SmsTemplate[]>(initialTemplates);
  const [editing, setEditing] = useState<SmsTemplate | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  const segments = smsSegmentCount(body);
  const fields = extractSmsFields(body);
  const preview = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => SAMPLE_DATA[k] ?? `[${k}]`);

  function startNew() {
    setEditing(null);
    setName("");
    setBody("");
    setCategory("general");
    setStatus("draft");
    setSaveMsg("");
    setEditorOpen(true);
  }

  function startEdit(tpl: SmsTemplate) {
    setEditing(tpl);
    setName(tpl.name);
    setBody(tpl.body);
    setCategory(tpl.category);
    setStatus(tpl.status);
    setSaveMsg("");
    setEditorOpen(true);
  }

  function insertField(field: string) {
    setBody((prev) => prev + `{{${field}}}`);
  }

  async function saveTemplate(input: { id: string | null; name: string; body: string; category: string; status: string }) {
    const res = await fetch("/api/admin/sms/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionToken: token, ...input }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Failed to save.");
    return data as { id: string };
  }

  async function refresh() {
    const freshRes = await fetch("/api/admin/sms/templates?status=all", {
      headers: { "x-sig-action-token": token ?? "" },
    });
    const freshData = await freshRes.json();
    const next: SmsTemplate[] = freshData.templates ?? [];
    setTemplates(next);
    return next;
  }

  async function handleSave() {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const saved = await saveTemplate({ id: editing?.id ?? null, name, body, category, status });
      setSaveMsg("Template saved.");
      const next = await refresh();
      // Keep editing the saved row so a second save updates instead of creating a duplicate.
      setEditing(next.find((t) => t.id === saved.id) ?? editing);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatusFor(list: SmsTemplate[], next: "active" | "draft") {
    for (const t of list.filter((x) => x.status !== next)) {
      await saveTemplate({ id: t.id, name: t.name, body: t.body, category: t.category, status: next });
    }
    await refresh();
  }

  const columns: DataColumn<SmsTemplate>[] = [
    { id: "name", label: "Name", required: true, width: 240, sort: (t) => t.name, cell: (t) => <span className="font-medium">{t.name}</span> },
    { id: "body", label: "Message", width: 360, exportValue: (t) => t.body, cell: (t) => <span className="text-muted-foreground">{t.body}</span> },
    { id: "category", label: "Category", width: 140, sort: (t) => categoryLabel(t.category), cell: (t) => categoryLabel(t.category) },
    { id: "segments", label: "Segments", width: 100, align: "right", sort: (t) => smsSegmentCount(t.body), cell: (t) => smsSegmentCount(t.body) },
    { id: "status", label: "Status", width: 110, sort: (t) => t.status, cell: (t) => <StatusBadge status={t.status} /> },
    { id: "fields", label: "Fields", width: 200, defaultHidden: true, exportValue: (t) => (t.available_fields ?? []).join("; "), cell: (t) => (t.available_fields ?? []).join(", ") || "—" },
    { id: "updated", label: "Updated", width: 140, sort: (t) => t.updated_at, cell: (t) => (t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "—") },
  ];

  return (
    <div className="space-y-4">
      <DataView<SmsTemplate>
        storageKey="sms-templates"
        exportName="sig-sms-templates"
        noun={["template", "templates"]}
        defaultView="list"
        items={templates}
        getId={(t) => t.id}
        title={(t) => t.name}
        subtitle={(t) => t.body}
        media={() => (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
            <MessageSquareText className="h-4 w-4" />
          </span>
        )}
        badge={(t) => <StatusBadge status={t.status} />}
        meta={(t) => `${categoryLabel(t.category)} · ${smsSegmentCount(t.body)} seg`}
        columns={columns}
        searchText={(t) => `${t.name} ${t.body} ${t.category} ${t.status}`}
        stats={[
          { label: "Templates", value: templates.length, icon: MessageSquareText },
          { label: "Active", value: templates.filter((t) => t.status === "active").length, icon: CheckCircle2 },
          { label: "Drafts", value: templates.filter((t) => t.status === "draft").length, icon: FilePen },
        ]}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "active", label: "Active", test: (t) => t.status === "active" },
          { id: "draft", label: "Drafts", test: (t) => t.status === "draft" },
        ]}
        selectFilters={[{ id: "category", label: "Category", options: CATEGORIES, get: (t) => t.category }]}
        board={{
          lanes: [{ id: "draft", label: "Draft" }, { id: "active", label: "Active" }],
          get: (t) => (t.status === "active" ? "active" : "draft"),
          onMove: (t, lane) => setStatusFor([t], lane as "active" | "draft").catch((e) => window.alert(e instanceof Error ? e.message : "Could not update template.")),
        }}
        onOpen={startEdit}
        add={{ label: "New template", onClick: startNew }}
        actions={[
          { label: "Edit", icon: Pencil, single: true, run: (sel) => startEdit(sel[0]) },
          { label: "Activate", icon: CheckCircle2, show: (sel) => sel.some((t) => t.status !== "active"), run: (sel) => setStatusFor(sel, "active") },
          { label: "Move to draft", icon: Undo2, show: (sel) => sel.some((t) => t.status !== "draft"), run: (sel) => setStatusFor(sel, "draft") },
        ]}
        empty="No templates yet. Create your first one."
      />

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5 text-left">
            <SheetTitle>{editing ? `Editing: ${editing.name}` : "New template"}</SheetTitle>
            <SheetDescription>Use {"{{field_name}}"} for dynamic personalization</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-5">
      {/* Editor */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Check-In Reminder" className="mt-1" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="general">General</option>
                  <option value="reminder">Reminder</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">Message body</label>
                <span className="text-xs text-muted-foreground">{body.length} chars · {segments} segment{segments !== 1 ? "s" : ""}</span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={1600}
                placeholder="Hi {{first_name}}, ..."
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Dynamic fields</p>
              <div className="flex flex-wrap gap-1">
                {DEFAULT_SMS_FIELDS.map((f) => (
                  <button
                    key={f}
                    onClick={() => insertField(f)}
                    className="rounded bg-muted px-2 py-0.5 font-mono text-xs hover:bg-accent transition-colors"
                  >
                    {"{{"}{f}{"}}"}
                  </button>
                ))}
              </div>
            </div>

            {fields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Fields used in this template</p>
                <div className="flex flex-wrap gap-1">
                  {fields.map((f) => <Badge key={f} variant="outline" className="font-mono text-xs">{f}</Badge>)}
                </div>
              </div>
            )}

            {saveMsg && (
              <p className={`text-sm ${saveMsg.includes("saved") ? "text-green-600" : "text-destructive"}`}>{saveMsg}</p>
            )}

            <Button onClick={handleSave} disabled={saving || !name.trim() || !body.trim()} className="w-full">
              {saving ? "Saving…" : "Save template"}
            </Button>
          </CardContent>
        </Card>

        {body && (
          <Card>
            <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4 font-sans text-sm whitespace-pre-wrap">{preview}</div>
            </CardContent>
          </Card>
        )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "reminder", label: "Reminder" },
  { value: "follow_up", label: "Follow-up" },
  { value: "announcement", label: "Announcement" },
];
const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"} className="shrink-0 text-xs capitalize">
      {status}
    </Badge>
  );
}
