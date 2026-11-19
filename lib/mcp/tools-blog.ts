// Blog posts (Content → Blog Posts). Reuses lib/content/blog.ts so the AI and
// the dashboard write posts the same way. Same access as the dashboard's blog
// API (requireContentManager): Super Admin, Admin, Content Reviewer.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBlogPostById, normalizePostTags, saveBlogPost, updateBlogPostStatus, type BlogPostInput } from "@/lib/content/blog";
import { trashRecord } from "./trash";
import { clamp, ilikeSafe, int, need, obj, opt, s, str, strArr, strEnum, type Json, type McpTool } from "./types";

const STATUSES = ["draft", "scheduled", "published", "hidden", "archived", "deleted"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Post = Record<string, unknown> & { id: string; title: string; slug: string; status: string };

async function findPost(ref: string): Promise<Post> {
  if (UUID.test(ref)) {
    const post = await getBlogPostById(ref);
    if (post) return post as Post;
  }
  const { data } = await createSupabaseAdminClient().from("blog_posts").select("id").eq("slug", ref.replace(/^\/?(resources\/)?/, "")).maybeSingle();
  if (data?.id) {
    const post = await getBlogPostById(data.id as string);
    if (post) return post as Post;
  }
  throw new Error(`No blog post matches "${ref}". Use sig_blog_list to find its id.`);
}

function shape(post: Post, full = false) {
  const category = post.category as { name?: string } | null;
  const base = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    url: `/resources/${post.slug}`,
    status: post.status,
    excerpt: post.excerpt ?? null,
    category: category?.name ?? null,
    tags: normalizePostTags(post).map((t: { name: string }) => t.name),
    author_name: post.author_name ?? null,
    featured_image_url: post.featured_image_url ?? null,
    publish_at: post.publish_at ?? null,
    deployed_at: post.deployed_at ?? null,
    updated_at: post.updated_at ?? null,
    edit_url: `/dashboard/blog-posts/${post.id}`,
  };
  return full ? { ...base, content_html: post.content_html ?? "", video_url: post.video_url ?? null, gallery_urls: post.gallery_urls ?? [] } : base;
}

/** Existing post → the full input saveBlogPost expects, so an update never blanks fields. */
function toInput(post: Post): BlogPostInput {
  const category = post.category as { name?: string } | null;
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: (post.excerpt as string) ?? undefined,
    contentHtml: (post.content_html as string) ?? "",
    authorName: (post.author_name as string) ?? undefined,
    category: category?.name ?? undefined,
    tags: normalizePostTags(post).map((t: { name: string }) => t.name),
    featuredImageUrl: (post.featured_image_url as string) ?? undefined,
    galleryUrls: (post.gallery_urls as string[]) ?? [],
    videoUrl: (post.video_url as string) ?? undefined,
    status: post.status as BlogPostInput["status"],
    publishAt: (post.publish_at as string) ?? undefined,
  };
}

function applyFields(input: BlogPostInput, a: Json): BlogPostInput {
  const next = { ...input };
  if (a.title !== undefined) next.title = s(a.title);
  if (a.slug !== undefined) next.slug = s(a.slug);
  if (a.excerpt !== undefined) next.excerpt = s(a.excerpt);
  if (a.content_html !== undefined) next.contentHtml = String(a.content_html ?? "");
  if (a.author_name !== undefined) next.authorName = s(a.author_name);
  if (a.category !== undefined) next.category = s(a.category);
  if (Array.isArray(a.tags)) next.tags = (a.tags as unknown[]).map((t) => s(t)).filter(Boolean);
  if (a.featured_image_url !== undefined) next.featuredImageUrl = s(a.featured_image_url);
  if (a.video_url !== undefined) next.videoUrl = s(a.video_url);
  if (Array.isArray(a.gallery_urls)) next.galleryUrls = (a.gallery_urls as unknown[]).map((t) => s(t)).filter(Boolean);
  return next;
}

const FIELDS = {
  title: str("Post title"),
  slug: str("URL slug (optional; generated from the title). The post lives at /resources/<slug>."),
  excerpt: str("Short summary shown on the blog list"),
  content_html: str("Body as HTML (<p>, <h2>, <ul>, <a>, <img>…)"),
  author_name: str("Byline (default: Strategic Income Group)"),
  category: str("Category name (created if new)"),
  tags: strArr("Tag names (replaces the post's tags)"),
  featured_image_url: str("Featured image URL"),
  video_url: str("Optional video URL"),
  gallery_urls: strArr("Optional gallery image URLs"),
};

export function blogTools(): McpTool[] {
  return [
    {
      name: "sig_blog_list",
      title: "List blog posts",
      description: "List SIG blog posts (newest edits first) with status, slug and category. Filter by status or search the title/excerpt. Deleted posts are hidden unless status=deleted.",
      risk: "read",
      area: "blog",
      inputSchema: obj({ status: strEnum(STATUSES, "Only posts with this status"), search: str("Words in the title or excerpt"), limit: int("Max rows (default 25)") }),
      run: async (a) => {
        let q = createSupabaseAdminClient()
          .from("blog_posts")
          .select("*, category:blog_post_categories(name,slug), tags:blog_post_tag_links(blog_post_tags(id,name,slug))", { count: "exact" })
          .order("updated_at", { ascending: false })
          .limit(clamp(a.limit, 25, 100));
        const status = opt(a.status);
        q = status ? q.eq("status", status) : q.neq("status", "deleted");
        const term = ilikeSafe(s(a.search));
        if (term) q = q.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%,slug.ilike.%${term}%`);
        const { data, count, error } = await q;
        if (error) throw new Error(error.message);
        return { result: { total: count ?? 0, posts: (data ?? []).map((p) => shape(p as Post)) } };
      },
    },
    {
      name: "sig_blog_get",
      title: "Read a blog post",
      description: "Read one blog post in full (HTML body, tags, category, status) by id or slug.",
      risk: "read",
      area: "blog",
      inputSchema: obj({ post: str("Post id or slug") }, ["post"]),
      run: async (a) => ({ result: shape(await findPost(need(a, "post")), true) }),
    },
    {
      name: "sig_blog_categories",
      title: "Blog categories and tags",
      description: "List the blog categories and tags already in use, so new posts reuse them.",
      risk: "read",
      area: "blog",
      inputSchema: obj(),
      run: async () => {
        const sb = createSupabaseAdminClient();
        const [cats, tags] = await Promise.all([
          sb.from("blog_post_categories").select("id,name,slug").order("name"),
          sb.from("blog_post_tags").select("id,name,slug").order("name"),
        ]);
        return { result: { categories: cats.data ?? [], tags: tags.data ?? [] } };
      },
    },
    {
      name: "sig_blog_create",
      title: "Create a blog post draft",
      description: "Create a new blog post as a DRAFT (never live). Publish it afterwards with sig_blog_publish once the person approves.",
      risk: "write",
      area: "blog",
      inputSchema: obj(FIELDS, ["title", "content_html"]),
      run: async (a, c) => {
        const input = applyFields({ title: need(a, "title"), contentHtml: String(a.content_html ?? ""), status: "draft" }, a);
        const post = await saveBlogPost({ ...input, status: "draft", actorUserId: c.profile.id });
        const full = (await getBlogPostById(post.id)) as Post;
        return { result: { created: true, ...shape(full) }, summary: `Created blog draft "${post.title}"`, entity: "blog_post", recordId: post.id, after: post };
      },
    },
    {
      name: "sig_blog_update",
      title: "Edit a blog post",
      description: "Change a blog post's title, body, excerpt, slug, category, tags or images. Only the fields you pass change. Editing a PUBLISHED post changes the live site, so for those it returns a preview + confirmation_id first.",
      risk: "write",
      area: "blog",
      inputSchema: obj({ post: str("Post id or slug"), ...FIELDS }, ["post"]),
      escalate: async (a) => {
        const post = await findPost(need(a, "post"));
        if (post.status !== "published") return null;
        const changed = Object.keys(FIELDS).filter((k) => a[k] !== undefined);
        return { summary: `Edit the LIVE blog post "${post.title}" (${changed.join(", ") || "no fields"}). Visitors see the change immediately.`, details: { id: post.id, url: `/resources/${post.slug}`, fields: changed }, entity: "blog_post", recordId: post.id };
      },
      run: async (a, c) => {
        const post = await findPost(need(a, "post"));
        const saved = await saveBlogPost({ ...applyFields(toInput(post), a), actorUserId: c.profile.id });
        const full = (await getBlogPostById(saved.id)) as Post;
        return { result: { updated: true, ...shape(full) }, summary: `Edited blog post "${saved.title}"`, entity: "blog_post", recordId: saved.id, before: post, after: saved };
      },
    },
    {
      name: "sig_blog_publish",
      title: "Publish a blog post",
      description: "Publish a blog post to the public site (/resources/<slug>). Optionally pass publish_at (ISO date/time) to schedule it. High risk: returns a preview first.",
      risk: "high",
      area: "blog",
      openWorld: true,
      inputSchema: obj({ post: str("Post id or slug"), publish_at: str("Optional ISO date/time to go live (default now)") }, ["post"]),
      preview: async (a) => {
        const post = await findPost(need(a, "post"));
        if (post.status === "published" && !a.publish_at) throw new Error(`"${post.title}" is already published.`);
        const when = opt(a.publish_at);
        return { summary: `Publish "${post.title}" to the public website${when ? ` at ${when}` : " now"}.`, details: { id: post.id, url: `/resources/${post.slug}`, current_status: post.status }, entity: "blog_post", recordId: post.id };
      },
      execute: async (a, c) => {
        const post = await findPost(need(a, "post"));
        const when = opt(a.publish_at);
        if (when) {
          if (Number.isNaN(Date.parse(when))) throw new Error("publish_at must be an ISO date/time.");
          await createSupabaseAdminClient().from("blog_posts").update({ publish_at: new Date(when).toISOString() }).eq("id", post.id);
        }
        const saved = await updateBlogPostStatus({ id: post.id, status: "published", actorUserId: c.profile.id });
        return { result: { published: true, id: post.id, url: `/resources/${post.slug}`, publish_at: when ?? null }, summary: `Published blog post "${post.title}"`, entity: "blog_post", recordId: post.id, before: { status: post.status }, after: { status: saved.status } };
      },
    },
    {
      name: "sig_blog_unpublish",
      title: "Unpublish a blog post",
      description: "Take a blog post off the public site. `to` = hidden (default) or draft. High risk: returns a preview first.",
      risk: "high",
      area: "blog",
      openWorld: true,
      inputSchema: obj({ post: str("Post id or slug"), to: strEnum(["hidden", "draft"], "New status (default hidden)") }, ["post"]),
      preview: async (a) => {
        const post = await findPost(need(a, "post"));
        if (post.status !== "published" && post.status !== "scheduled") throw new Error(`"${post.title}" isn't live (status ${post.status}).`);
        return { summary: `Take "${post.title}" off the public website (status → ${opt(a.to) ?? "hidden"}).`, details: { id: post.id, url: `/resources/${post.slug}` }, entity: "blog_post", recordId: post.id };
      },
      execute: async (a, c) => {
        const post = await findPost(need(a, "post"));
        const to = opt(a.to) === "draft" ? "draft" : "hidden";
        await updateBlogPostStatus({ id: post.id, status: to, actorUserId: c.profile.id });
        return { result: { unpublished: true, id: post.id, status: to }, summary: `Unpublished blog post "${post.title}"`, entity: "blog_post", recordId: post.id, before: { status: post.status }, after: { status: to } };
      },
    },
    {
      name: "sig_blog_delete",
      title: "Delete a blog post",
      description: "Move a blog post to the trash (status deleted; off the site). Restorable with sig_restore. High risk: returns a preview first.",
      risk: "high",
      area: "blog",
      inputSchema: obj({ post: str("Post id or slug") }, ["post"]),
      preview: async (a) => {
        const post = await findPost(need(a, "post"));
        if (post.status === "deleted") throw new Error(`"${post.title}" is already deleted.`);
        return { summary: `Delete blog post "${post.title}" (currently ${post.status}). It can be restored from the trash.`, details: { id: post.id, url: `/resources/${post.slug}` }, entity: "blog_post", recordId: post.id };
      },
      execute: async (a, c) => {
        const post = await findPost(need(a, "post"));
        const { trashId, label, before } = await trashRecord("blog_post", post.id, c.profile);
        return { result: { deleted: true, label, trash_id: trashId, restore_with: "sig_restore" }, summary: `Deleted blog post "${label}"`, entity: "blog_post", recordId: post.id, before };
      },
    },
  ];
}
