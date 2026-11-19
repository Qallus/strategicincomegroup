import Link from "next/link";
import { Clock } from "lucide-react";
import { formatPostDate, type PublicPost } from "@/lib/public-site/posts";
import { cn } from "@/lib/utils";

export function PostCard({ post, featured }: { post: PublicPost; featured?: boolean }) {
  const category = post.categories[0];
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-lg",
        featured && "md:grid md:grid-cols-[1.2fr_1fr]",
      )}
    >
      <Link href={`/resources/${post.slug}`} className={cn("block overflow-hidden bg-muted", featured ? "aspect-[16/10] md:aspect-auto md:h-full" : "aspect-[16/9]")}>
        {post.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-brand-gold/20" />
        )}
      </Link>
      <div className={cn("flex flex-1 flex-col p-5", featured && "md:p-8")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {category ? (
            <Link href={`/resources?category=${category.slug}`} className="font-semibold uppercase tracking-[0.12em] text-gold hover:underline">
              {category.name.replace(/\s*\(.*\)$/, "")}
            </Link>
          ) : null}
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {post.readingMinutes} min read
          </span>
        </div>
        <h3 className={cn("mt-3 font-serif leading-snug", featured ? "text-3xl" : "text-xl")}>
          <Link href={`/resources/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </h3>
        <p className={cn("mt-2 flex-1 text-sm leading-relaxed text-muted-foreground", featured ? "line-clamp-5" : "line-clamp-3")}>{post.excerpt}</p>
        <Link href={`/resources/${post.slug}`} className="mt-4 text-sm font-semibold text-primary hover:underline">
          Read article →
        </Link>
      </div>
    </article>
  );
}
