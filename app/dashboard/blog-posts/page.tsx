import { BlogPostViews, type BlogPostRow } from "@/components/blog-posts/blog-post-views";
import { SectionHeader } from "@/components/dashboard/section-header";
import { getBlogAdminData, normalizePostTags } from "@/lib/content/blog";

export default async function BlogPostsPage() {
  const data = await getBlogAdminData();
  const posts = data.posts as any[];

  const rows: BlogPostRow[] = posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? null,
    status: post.status,
    featured_image_url: post.featured_image_url ?? null,
    author_name: post.author_name ?? null,
    category_name: post.category?.name ?? null,
    tags: normalizePostTags(post).map((t: any) => ({ id: t.id, name: t.name })),
    date: post.publish_at ?? post.created_at ?? null,
    linked_email_template_id: post.linked_email_template_id ?? null,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader title="Blog Posts" description="Create, schedule, deploy, hide, archive, and convert posts into email templates." />

      {/* Stats, filters, views, "New post" and bulk actions all live in the shared DataView. */}
      <BlogPostViews posts={rows} />

      {data.error ? <p className="text-sm text-destructive">{data.error}</p> : null}
    </div>
  );
}
