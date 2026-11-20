"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, FilePen, LayoutTemplate, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { PLATFORMS, platformLabel } from "@/lib/social-media/constants";
import type { SocialTemplate } from "@/lib/social-media/types";

const statusClass: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function StatusPill({ status }: { status: string }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", statusClass[status])}>{status}</span>;
}

const platformsText = (t: SocialTemplate) => t.platforms.map(platformLabel).join(", ");
const composeHref = (t: SocialTemplate) => `/dashboard/social-media/compose?template=${t.id}`;
const editHref = (t: SocialTemplate) => `/dashboard/social-media/editor?id=${t.id}`;

/** Social post templates on the shared DataView. Row → template preview with Use / Edit / Delete. */
export function SocialTemplateManager({ initialTemplates }: { initialTemplates: SocialTemplate[] }) {
  const router = useRouter();
  const token = useDashboardActionToken();
  const [templates, setTemplates] = React.useState(initialTemplates);

  async function remove(list: SocialTemplate[]) {
    if (!window.confirm(list.length === 1 ? `Delete template "${list[0].name}"?` : `Delete ${list.length} templates?`)) return false;
    for (const t of list) {
      const res = await fetch("/api/admin/social-media/templates", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id, actionToken: token }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed.");
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    }
    return true;
  }

  const categories = React.useMemo(() => [...new Set(templates.map((t) => t.category).filter(Boolean))].sort().map((c) => ({ value: c, label: c })), [templates]);

  const columns: DataColumn<SocialTemplate>[] = [
    { id: "name", label: "Name", required: true, width: 240, sort: (t) => t.name, cell: (t) => <span className="font-medium">{t.name}</span> },
    { id: "body", label: "Text", width: 340, exportValue: (t) => t.body_text, cell: (t) => <span className="text-muted-foreground">{t.body_text || "—"}</span> },
    { id: "platforms", label: "Platforms", width: 200, sort: platformsText, cell: (t) => platformsText(t) || "—" },
    { id: "category", label: "Category", width: 150, sort: (t) => t.category, cell: (t) => t.category || "—" },
    { id: "status", label: "Status", width: 110, sort: (t) => t.status, cell: (t) => <StatusPill status={t.status} /> },
    { id: "hashtags", label: "Hashtags", width: 220, exportValue: (t) => t.hashtags.join(" "), cell: (t) => (t.hashtags.length ? <span className="text-primary">{t.hashtags.join(" ")}</span> : "—") },
    { id: "updated", label: "Updated", width: 140, defaultHidden: true, sort: (t) => t.updated_at, cell: (t) => (t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "—") },
  ];

  return (
    <DataView<SocialTemplate>
      storageKey="social-templates"
      exportName="sig-social-templates"
      noun={["template", "templates"]}
      defaultView="cards"
      items={templates}
      getId={(t) => t.id}
      title={(t) => t.name}
      subtitle={(t) => [t.category, platformsText(t)].filter(Boolean).join(" · ")}
      badge={(t) => <StatusPill status={t.status} />}
      meta={(t) => (t.hashtags.length ? <span className="block max-w-[16rem] truncate text-primary">{t.hashtags.join(" ")}</span> : null)}
      columns={columns}
      searchText={(t) => `${t.name} ${t.category} ${t.body_text} ${t.hashtags.join(" ")} ${platformsText(t)}`}
      stats={[
        { label: "Templates", value: templates.length, icon: LayoutTemplate },
        { label: "Active", value: templates.filter((t) => t.status === "active").length, icon: CheckCircle2 },
        { label: "Drafts", value: templates.filter((t) => t.status === "draft").length, icon: FilePen },
        { label: "Archived", value: templates.filter((t) => t.status === "archived").length, icon: Archive },
      ]}
      filters={[
        { id: "all", label: "All statuses", test: () => true },
        { id: "active", label: "Active", test: (t) => t.status === "active" },
        { id: "draft", label: "Draft", test: (t) => t.status === "draft" },
        { id: "archived", label: "Archived", test: (t) => t.status === "archived" },
      ]}
      selectFilters={[
        { id: "category", label: "Category", options: categories, get: (t) => t.category },
        { id: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p.id, label: p.label })), get: (t) => t.platforms },
      ]}
      add={{ label: "New template", onClick: () => router.push("/dashboard/social-media/editor") }}
      actions={[
        { label: "Use", icon: Send, single: true, run: (sel) => router.push(composeHref(sel[0])) },
        { label: "Edit", icon: Pencil, single: true, run: (sel) => router.push(editHref(sel[0])) },
        { label: "Delete", icon: Trash2, destructive: true, run: remove },
      ]}
      preview={(t, close) => <TemplatePreview template={t} onDelete={() => remove([t]).then((done) => (done ? close() : undefined))} />}
      empty="No templates. Build one in the Block Editor."
    />
  );
}

function TemplatePreview({ template: t, onDelete }: { template: SocialTemplate; onDelete: () => Promise<unknown> }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-5">
      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusPill status={t.status} />
        <span>{t.category}</span>
        {t.platforms.length ? <span>· {platformsText(t)}</span> : null}
      </div>
      {t.description ? <p className="text-sm text-muted-foreground">{t.description}</p> : null}
      <p className="whitespace-pre-wrap break-words rounded-xl border bg-muted/30 p-4 text-sm">{t.body_text || "—"}</p>
      {t.hashtags.length ? <p className="text-sm text-primary">{t.hashtags.join(" ")}</p> : null}
      {t.link_url ? <p className="break-all text-sm"><span className="text-muted-foreground">Link: </span>{t.link_url}</p> : null}
      {t.media_urls.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {t.media_urls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className="aspect-square w-full rounded-md border object-cover" />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button asChild size="sm">
          <Link href={composeHref(t)}><Send className="h-4 w-4" /> Use</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={editHref(t)}><Pencil className="h-4 w-4" /> Edit</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try { await onDelete(); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); } finally { setBusy(false); }
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}
