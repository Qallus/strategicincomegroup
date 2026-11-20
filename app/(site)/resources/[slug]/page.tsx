import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { Container, CtaBand } from "@/components/public-site/blocks";
import { PostCard } from "@/components/public-site/post-card";
import { PostSidebar } from "@/components/public-site/post-sidebar";
import { StickyAside } from "@/components/public-site/sticky-aside";
import { formatPostDate, getAllPosts, getPost } from "@/lib/public-site/posts";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const post = await getPost((await params).slug);
  if (!post) return { title: "Article not found" };
  return {
    title: post.title,
    description: post.excerpt.slice(0, 160),
    openGraph: { title: post.title, description: post.excerpt.slice(0, 200), images: post.image ? [post.image] : undefined, type: "article" },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const related = (await getAllPosts())
    .filter((p) => p.slug !== post.slug && p.categories.some((c) => post.categories.some((pc) => pc.slug === c.slug)))
    .slice(0, 3);

  return (
    <>
      <article>
        <header className="border-b bg-muted/40">
          <Container className="py-12 md:py-16">
            <Link href="/resources" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Resources
            </Link>
            <div className="mt-6 flex flex-wrap gap-2">
              {post.categories.map((c) => (
                <Link key={c.slug} href={`/resources?category=${c.slug}`} className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-gold hover:border-primary/40">
                  {c.name.replace(/\s*\(.*\)$/, "")}
                </Link>
              ))}
            </div>
            <h1 className="mt-4 max-w-4xl text-balance font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>{post.author || "Strategic Income Group"}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> <time dateTime={post.date}>{formatPostDate(post.date)}</time></span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {post.readingMinutes} min read</span>
            </div>
          </Container>
        </header>

        {/* Same box as the header (max-w-[1200px] + its padding): edges line up with the logo and the colour-mode toggle. */}
        <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 xl:gap-16">
          <div className="min-w-0">
            {post.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.image} alt="" className="mb-10 aspect-[16/9] w-full rounded-2xl border object-cover" />
            ) : null}
            {/* Post HTML comes from the dashboard editor or the sanitised WordPress snapshot. */}
            <div className="sig-prose max-w-[72ch]" dangerouslySetInnerHTML={{ __html: post.html }} />
          </div>
          <StickyAside label="Talk to a planner and contact information">
            <PostSidebar />
          </StickyAside>
        </Container>
      </article>

      {related.length ? (
        <section className="border-t bg-muted/40 py-16">
          <Container>
            <h2 className="font-serif text-3xl">Related articles</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <CtaBand />
    </>
  );
}
