"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, CalendarClock, ExternalLink, EyeOff, FileText, ImageOff, MailPlus, Pencil, Rocket, Send, Share2, Trash2,
} from "lucide-react";
import { BlogPostShareDialog, runBlogPostAction, type BlogPostAction } from "@/components/blog-posts/blog-post-actions";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { cn } from "@/lib/utils";

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: string;
  featured_image_url: string | null;
  author_name: string | null;
  category_name: string | null;
  tags: { id: string; name: string }[];
  date: string | null;
  linked_email_template_id: string | null;
};

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
  { value: "archived", label: "Archived" },
];
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  hidden: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  archived: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};
const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;
const AUTHOR_FALLBACK = "Strategic Income Group";
const author = (r: BlogPostRow) => r.author_name || AUTHOR_FALLBACK;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—");

function StatusPill({ status }: { status: string }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CLASS[status] ?? "bg-muted")}>{statusLabel(status)}</span>;
}

/** Featured-image thumbnail used across list / cards / table. */
function Thumb({ url, className }: { url: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className={cn("shrink-0 rounded-md border object-cover", className)} />;
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground", className)}>
      <ImageOff className="h-4 w-4" />
    </div>
  );
}

const options = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));

/** Blog Posts list on the shared DataView: stats, filters, list/table/cards/board/calendar, bulk actions. */
export function BlogPostViews({ posts }: { posts: BlogPostRow[] }) {
  const router = useRouter();
  const token = useDashboardActionToken();
  const [rows, setRows] = useState(posts);
  const [sharing, setSharing] = useState<BlogPostRow | null>(null);
  useEffect(() => setRows(posts), [posts]);

  async function act(ids: string[], action: BlogPostAction) {
    const results = await Promise.allSettled(ids.map((id) => runBlogPostAction(id, action, token)));
    const ok = ids.filter((_, i) => results[i].status === "fulfilled");
    setRows((list) => {
      if (action === "deleted") return list.filter((r) => !ok.includes(r.id));
      return list.map((r) => {
        const at = ids.indexOf(r.id);
        if (at < 0 || !ok.includes(r.id)) return r;
        if (action === "convert_to_email") {
          const res = results[at] as PromiseFulfilledResult<Awaited<ReturnType<typeof runBlogPostAction>>>;
          return { ...r, linked_email_template_id: res.value.template?.id ?? r.linked_email_template_id ?? "linked" };
        }
        return { ...r, status: action };
      });
    });
    router.refresh();
    const failed = results.find((x): x is PromiseRejectedResult => x.status === "rejected");
    if (failed) throw failed.reason instanceof Error ? failed.reason : new Error("Action failed.");
  }

  const categories = useMemo(() => options(rows.map((r) => r.category_name)), [rows]);
  const tags = useMemo(() => options(rows.flatMap((r) => r.tags.map((t) => t.name))), [rows]);
  const authors = useMemo(() => options(rows.map(author)), [rows]);
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  const columns: DataColumn<BlogPostRow>[] = [
    {
      id: "title",
      label: "Title",
      required: true,
      width: 340,
      sort: (r) => r.title,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <Thumb url={r.featured_image_url} className="h-9 w-14" />
          <span className="truncate font-medium">{r.title}</span>
        </span>
      ),
    },
    { id: "category", label: "Category", width: 170, sort: (r) => r.category_name, cell: (r) => r.category_name ?? "—" },
    { id: "author", label: "Author", width: 180, sort: author, cell: author },
    { id: "date", label: "Publish date", width: 140, sort: (r) => r.date, exportValue: (r) => (r.date ? new Date(r.date).toISOString() : ""), cell: (r) => fmtDate(r.date) },
    { id: "status", label: "Status", width: 120, sort: (r) => statusLabel(r.status), cell: (r) => <StatusPill status={r.status} /> },
    {
      id: "tags",
      label: "Tags",
      width: 220,
      exportValue: (r) => r.tags.map((t) => t.name).join("; "),
      cell: (r) => (r.tags.length ? <span className="text-muted-foreground">{r.tags.map((t) => t.name).join(", ")}</span> : "—"),
    },
    { id: "email", label: "Email template", width: 140, sort: (r) => (r.linked_email_template_id ? "Linked" : ""), cell: (r) => (r.linked_email_template_id ? "Linked" : "—") },
    { id: "slug", label: "URL", width: 240, defaultHidden: true, sort: (r) => r.slug, cell: (r) => <span className="text-muted-foreground">/resources/{r.slug}</span> },
    { id: "excerpt", label: "Excerpt", width: 320, defaultHidden: true, exportValue: (r) => r.excerpt, cell: (r) => <span className="text-muted-foreground">{r.excerpt || "—"}</span> },
  ];

  return (
    <>
      <DataView<BlogPostRow>
        storageKey="blog-posts"
        exportName="sig-blog-posts"
        noun={["post", "posts"]}
        defaultView="cards"
        items={rows}
        getId={(r) => r.id}
        title={(r) => r.title}
        subtitle={(r) => [r.category_name, author(r), r.date ? fmtDate(r.date) : null].filter(Boolean).join(" · ")}
        media={(r) => <Thumb url={r.featured_image_url} className="h-12 w-20" />}
        cardImage={(r) => r.featured_image_url}
        badge={(r) => <StatusPill status={r.status} />}
        meta={(r) => <span className="block max-w-[16rem] truncate">{r.tags.length ? r.tags.map((t) => `#${t.name}`).join(" ") : `/resources/${r.slug}`}</span>}
        columns={columns}
        searchText={(r) => [r.title, r.slug, r.excerpt, r.category_name, author(r), r.status, r.tags.map((t) => t.name).join(" ")].join(" ")}
        stats={[
          { label: "Published", value: count("published"), icon: FileText, hint: "Live on Resources" },
          { label: "Drafts", value: count("draft"), icon: FileText, hint: "Needs review" },
          { label: "Scheduled", value: count("scheduled"), icon: CalendarClock, hint: "Future publish dates" },
          { label: "Email-ready", value: rows.filter((r) => r.linked_email_template_id).length, icon: Send, hint: "Linked templates" },
        ]}
        filters={[{ id: "all", label: "All", test: () => true }, ...STATUSES.map((s) => ({ id: s.value, label: s.label, test: (r: BlogPostRow) => r.status === s.value }))]}
        selectFilters={[
          { id: "category", label: "Category", options: categories, get: (r) => r.category_name },
          { id: "tags", label: "Tags", options: tags, get: (r) => r.tags.map((t) => t.name) },
          { id: "author", label: "Author", options: authors, get: author },
        ]}
        board={{
          lanes: STATUSES.map((s) => ({ id: s.value, label: s.label })),
          get: (r) => r.status,
          onMove: (r, lane) => act([r.id], lane as BlogPostAction).catch((e) => window.alert(e instanceof Error ? e.message : "Could not move that post.")),
        }}
        date={(r) => r.date}
        onOpen={(r) => router.push(`/dashboard/blog-posts/${r.id}`)}
        add={{ label: "New post", onClick: () => router.push("/dashboard/blog-posts/new") }}
        actions={[
          { label: "Edit", icon: Pencil, single: true, run: (sel) => router.push(`/dashboard/blog-posts/${sel[0].id}`) },
          { label: "Deploy", icon: Rocket, run: (sel) => act(sel.map((r) => r.id), "published") },
          { label: "Hide", icon: EyeOff, run: (sel) => act(sel.map((r) => r.id), "hidden") },
          { label: "Archive", icon: Archive, run: (sel) => act(sel.map((r) => r.id), "archived") },
          { label: "Email blog", icon: MailPlus, run: (sel) => act(sel.map((r) => r.id), "convert_to_email") },
          { label: "View", icon: ExternalLink, single: true, run: (sel) => window.open(`/resources/${sel[0].slug}`, "_blank", "noopener,noreferrer") },
          { label: "Share", icon: Share2, single: true, run: (sel) => setSharing(sel[0]) },
          {
            label: "Delete",
            icon: Trash2,
            destructive: true,
            run: (sel) => (window.confirm(`Delete ${sel.length} post${sel.length === 1 ? "" : "s"}?`) ? act(sel.map((r) => r.id), "deleted") : undefined),
          },
        ]}
        empty="No blog posts yet. Create the first Three Phases of Wealth resource."
      />
      <BlogPostShareDialog post={sharing} onClose={() => setSharing(null)} />
    </>
  );
}
