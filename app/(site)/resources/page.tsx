import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import { Container, PageHero } from "@/components/public-site/blocks";
import { PostCard } from "@/components/public-site/post-card";
import { getAllPosts, getCategories } from "@/lib/public-site/posts";
import { CONTACT } from "@/lib/public-site/site-data";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const metadata = {
  title: "Resources",
  description: "Financial planning resources, investment, trusts and retirement planning articles from Strategic Income Group.",
};

const PER_PAGE = 9;

type Props = { searchParams: Promise<{ q?: string; category?: string; page?: string }> };

function href(params: { q?: string; category?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return s ? `/resources?${s}` : "/resources";
}

export default async function ResourcesPage({ searchParams }: Props) {
  const { q = "", category = "", page: pageRaw } = await searchParams;
  const [all, categories] = await Promise.all([getAllPosts(), getCategories()]);

  const query = q.trim().toLowerCase();
  const filtered = all.filter(
    (p) =>
      (!category || p.categories.some((c) => c.slug === category)) &&
      (!query || p.title.toLowerCase().includes(query) || p.excerpt.toLowerCase().includes(query)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(pageRaw) || 1));
  const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const showFeatured = page === 1 && !query && !category && slice.length > 0;
  const [featured, ...rest] = showFeatured ? slice : [null, ...slice];
  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <>
      <PageHero
        tone="plain"
        eyebrow="Resources"
        title="Resources"
        breadcrumb={[{ label: "Resources" }]}
        description="Financial planning resources, investment, trusts, retirement planning articles."
      >
        <form action="/resources" className="mt-8 flex max-w-xl gap-2">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <label className="relative flex-1">
            <span className="sr-only">Search articles</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search articles…"
              className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <button type="submit" className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Search
          </button>
        </form>
      </PageHero>

      <Container className="py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            {query || category ? (
              <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {filtered.length} article{filtered.length === 1 ? "" : "s"}
                  {activeCategory ? <> in <strong className="text-foreground">{activeCategory.name}</strong></> : null}
                  {query ? <> matching “<strong className="text-foreground">{q}</strong>”</> : null}
                </span>
                <Link href="/resources" className="rounded-full border px-3 py-1 text-xs hover:bg-muted">
                  Clear filters ×
                </Link>
              </div>
            ) : null}

            {featured ? (
              <div className="mb-8">
                <PostCard post={featured} featured />
              </div>
            ) : null}

            {rest.length ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {rest.map((p) => p && <PostCard key={p.slug} post={p} />)}
              </div>
            ) : !featured ? (
              <div className="rounded-xl border border-dashed py-20 text-center text-muted-foreground">No articles match that search.</div>
            ) : null}

            {pages > 1 ? (
              <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
                <PageLink disabled={page <= 1} to={href({ q, category, page: page - 1 })} label="Previous">
                  <ChevronLeft className="h-4 w-4" />
                </PageLink>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={href({ q, category, page: n })}
                    aria-current={n === page ? "page" : undefined}
                    className={cn("flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm", n === page ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    {n}
                  </Link>
                ))}
                <PageLink disabled={page >= pages} to={href({ q, category, page: page + 1 })} label="Next">
                  <ChevronRight className="h-4 w-4" />
                </PageLink>
              </nav>
            ) : null}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="font-serif text-xl">Blog categories</h2>
              <ul className="mt-4 space-y-1 text-sm">
                <li>
                  <Link href={href({ q })} className={cn("flex justify-between rounded-md px-2 py-1.5 hover:bg-muted", !category && "bg-muted font-medium")}>
                    All articles <span className="text-muted-foreground">{all.length}</span>
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={href({ q, category: c.slug })}
                      className={cn("flex justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted", category === c.slug && "bg-muted font-medium")}
                    >
                      <span>{c.name}</span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/sigcares" className="group block rounded-xl border bg-card p-5 transition hover:border-primary/40">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">SIGCares</p>
              <h2 className="mt-1 font-serif text-xl">Feed My Starving Children</h2>
              <p className="mt-1 text-sm text-muted-foreground">See the meals our community has packed and the kids fed around the world.</p>
              <span className="mt-3 inline-block text-sm font-semibold text-primary group-hover:underline">See our impact →</span>
            </Link>
            <div className="rounded-xl border bg-card p-5">
              <h2 className="font-serif text-xl">Book a review online</h2>
              <div className="mt-4 grid gap-2">
                <Link href="/book?planner=laurie-simons" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">East Valley Meetings →</Link>
                <Link href="/book?planner=keri-alcos" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">West Valley Meetings →</Link>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 text-sm">
              <h2 className="font-serif text-xl">Disclosures</h2>
              <ul className="mt-3 space-y-2">
                <li><Link href="/privacy-policy" className="inline-flex items-center gap-2 hover:text-primary"><FileText className="h-4 w-4 text-gold" /> Privacy Policy</Link></li>
                <li><a href={CONTACT.crsPdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-primary"><FileText className="h-4 w-4 text-gold" /> Download the SIG CRS</a></li>
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}

function PageLink({ disabled, to, label, children }: { disabled: boolean; to: string; label: string; children: React.ReactNode }) {
  if (disabled) {
    return <span aria-disabled className="flex h-9 w-9 items-center justify-center rounded-md border opacity-40">{children}</span>;
  }
  return (
    <Link href={to} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted">
      {children}
    </Link>
  );
}
