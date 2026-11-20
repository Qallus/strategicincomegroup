"use client";

import * as React from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, FilePen, Heart, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { PLATFORMS, POST_STATUSES, platformColor, platformLabel } from "@/lib/social-media/constants";
import type { SocialPost } from "@/lib/social-media/types";

const statusClass: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  publishing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-600 dark:text-red-400",
  skipped: "bg-muted text-muted-foreground line-through",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fmt(iso: string | null | undefined) { return iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"; }
function eng(p: SocialPost) { const e = p.engagement ?? {}; return (e.likes ?? 0) + (e.comments ?? 0) + (e.shares ?? 0); }
const canPublish = (p: SocialPost) => p.status === "draft" || p.status === "scheduled" || p.status === "failed";
const when = (p: SocialPost) => (p.status === "scheduled" ? p.scheduled_at : p.status === "published" ? p.published_at : null) ?? p.created_at ?? null;
const whenLabel = (p: SocialPost) =>
  p.status === "scheduled" ? `Scheduled ${fmt(p.scheduled_at)}` : p.status === "published" ? `Published ${fmt(p.published_at)}` : `Created ${fmt(p.created_at)}`;

function StatusPill({ status }: { status: string }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", statusClass[status])}>{status}</span>;
}

function PlatformChip({ platform }: { platform: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-[10px] font-bold uppercase" style={{ color: platformColor(platform) }} title={platformLabel(platform)}>
      {platformLabel(platform).slice(0, 2)}
    </span>
  );
}

/** Social post history on the shared DataView. Row → post preview; publish / delete in bulk. */
export function SocialHistory({ initialPosts }: { initialPosts: SocialPost[] }) {
  const token = useDashboardActionToken();
  const [posts, setPosts] = React.useState(initialPosts);
  const [loading, setLoading] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/social-media/posts", { headers: { "x-sig-action-token": token } }).then((x) => x.json());
      if (r.posts) setPosts(r.posts);
    } finally {
      setLoading(false);
    }
  }, [token]);
  React.useEffect(() => { reload(); }, [reload]);

  async function publish(list: SocialPost[]) {
    const targets = list.filter(canPublish);
    try {
      for (const p of targets) {
        const res = await fetch("/api/admin/social-media/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, actionToken: token }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Publish failed.");
      }
    } finally {
      await reload();
    }
  }

  async function remove(list: SocialPost[]) {
    if (!window.confirm(list.length === 1 ? "Delete this post?" : `Delete ${list.length} posts?`)) return false;
    try {
      for (const p of list) {
        const res = await fetch(`/api/admin/social-media/posts/${p.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionToken: token }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed.");
      }
    } finally {
      await reload();
    }
    return true;
  }

  const accounts = React.useMemo(
    () => [...new Set(posts.map((p) => p.account?.display_name).filter((n): n is string => Boolean(n)))].sort().map((n) => ({ value: n, label: n })),
    [posts],
  );
  const count = (s: string) => posts.filter((p) => p.status === s).length;

  const columns: DataColumn<SocialPost>[] = [
    { id: "body", label: "Post", required: true, width: 360, sort: (p) => p.body_text, cell: (p) => <span>{p.body_text || "—"}</span> },
    { id: "platform", label: "Platform", width: 130, sort: (p) => platformLabel(p.platform), cell: (p) => platformLabel(p.platform) },
    { id: "when", label: "Date", width: 200, sort: when, exportValue: (p) => when(p) ?? "", cell: whenLabel },
    { id: "engagement", label: "Engagement", width: 120, align: "right", sort: eng, cell: (p) => (p.status === "published" ? eng(p) : "—") },
    { id: "status", label: "Status", width: 120, sort: (p) => p.status, cell: (p) => <StatusPill status={p.status} /> },
    { id: "account", label: "Account", width: 180, sort: (p) => p.account?.display_name, cell: (p) => p.account?.display_name ?? "—" },
    { id: "template", label: "Template", width: 180, defaultHidden: true, sort: (p) => p.template?.name, cell: (p) => p.template?.name ?? "—" },
    { id: "error", label: "Error", width: 240, defaultHidden: true, sort: (p) => p.error_message, cell: (p) => (p.error_message ? <span className="text-destructive">{p.error_message}</span> : "—") },
    { id: "url", label: "Link", width: 220, defaultHidden: true, exportValue: (p) => p.external_url, cell: (p) => p.external_url ?? "—" },
  ];

  return (
    <DataView<SocialPost>
      storageKey="social-history"
      exportName="sig-social-posts"
      noun={["post", "posts"]}
      defaultView="list"
      loading={loading}
      items={posts}
      getId={(p) => p.id}
      title={(p) => p.body_text || "—"}
      subtitle={(p) => [platformLabel(p.platform), whenLabel(p), p.status === "published" ? `${eng(p)} engagements` : null, p.error_message].filter(Boolean).join(" · ")}
      media={(p) => <PlatformChip platform={p.platform} />}
      badge={(p) => <StatusPill status={p.status} />}
      meta={(p) => p.account?.display_name ?? platformLabel(p.platform)}
      columns={columns}
      searchText={(p) => [p.body_text, p.hashtags.join(" "), platformLabel(p.platform), p.status, p.account?.display_name, p.template?.name, p.error_message].join(" ")}
      stats={[
        { label: "Published", value: count("published"), icon: CheckCircle2 },
        { label: "Scheduled", value: count("scheduled"), icon: CalendarClock },
        { label: "Drafts", value: count("draft"), icon: FilePen },
        { label: "Failed", value: count("failed"), icon: AlertTriangle },
        { label: "Engagement", value: posts.reduce((n, p) => n + (p.status === "published" ? eng(p) : 0), 0), icon: Heart, hint: "Likes + comments + shares" },
      ]}
      filters={[
        { id: "all", label: "All posts", test: () => true },
        { id: "draft", label: "Drafts", test: (p) => p.status === "draft" },
        { id: "scheduled", label: "Scheduled", test: (p) => p.status === "scheduled" },
        { id: "published", label: "Published", test: (p) => p.status === "published" },
        { id: "failed", label: "Failed", test: (p) => p.status === "failed" },
      ]}
      selectFilters={[
        { id: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p.id, label: p.label })), get: (p) => p.platform },
        ...(accounts.length ? [{ id: "account", label: "Account", options: accounts, get: (p: SocialPost) => p.account?.display_name }] : []),
      ]}
      board={{ lanes: POST_STATUSES.map((s) => ({ id: s, label: cap(s) })), get: (p) => p.status }}
      date={when}
      actions={[
        { label: "Publish", icon: Send, show: (sel) => sel.some(canPublish), run: publish },
        { label: "Open post", icon: ExternalLink, single: true, show: (sel) => Boolean(sel[0]?.external_url), run: (sel) => window.open(sel[0].external_url!, "_blank", "noreferrer") },
        { label: "Delete", icon: Trash2, destructive: true, run: remove },
      ]}
      preview={(p, close) => <PostPreview post={p} onPublish={() => publish([p])} onDelete={() => remove([p]).then((done) => (done ? close() : undefined))} />}
      empty="No posts yet. Compose one to get started."
    />
  );
}

function PostPreview({ post: p, onPublish, onDelete }: { post: SocialPost; onPublish: () => Promise<void>; onDelete: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "That action failed."); } finally { setBusy(false); }
  };
  const e = p.engagement ?? {};
  const facts: [string, React.ReactNode][] = [
    ["Status", <StatusPill key="s" status={p.status} />],
    ["Platform", platformLabel(p.platform)],
    ["Account", p.account?.display_name],
    ["Template", p.template?.name],
    ["Created", fmt(p.created_at)],
    ["Scheduled", p.scheduled_at ? fmt(p.scheduled_at) : null],
    ["Published", p.published_at ? fmt(p.published_at) : null],
    ["Engagement", p.status === "published" ? `${e.likes ?? 0} likes · ${e.comments ?? 0} comments · ${e.shares ?? 0} shares` : null],
    ["Link", p.link_url],
  ];
  return (
    <div className="space-y-5">
      {error || p.error_message ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error ?? p.error_message}</div>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-sm">{p.body_text || "—"}</p>
      {p.hashtags.length ? <p className="text-sm text-primary">{p.hashtags.join(" ")}</p> : null}
      {p.media_urls.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {p.media_urls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className="aspect-square w-full rounded-md border object-cover" />
          ))}
        </div>
      ) : null}
      <dl className="grid gap-2 rounded-xl border bg-muted/30 p-4 text-sm">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[100px_1fr] gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
      </dl>
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {canPublish(p) ? (
          <Button size="sm" disabled={busy} onClick={() => run(onPublish)}>
            <Send className="h-4 w-4" /> Publish
          </Button>
        ) : null}
        {p.external_url ? (
          <Button asChild size="sm" variant="outline">
            <a href={p.external_url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Open post
            </a>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="ml-auto text-destructive" disabled={busy} onClick={() => run(onDelete)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}
