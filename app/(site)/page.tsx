import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { HomeHero } from "@/components/public-site/home-hero";
import { ButtonLink, CtaBand, PhaseCards, PlannerGrid, Section, SectionHeading } from "@/components/public-site/blocks";
import { SiteIcon } from "@/components/public-site/icons";
import { PostCard } from "@/components/public-site/post-card";
import { CEO_BIO, IMPACT_GOAL, SOLUTIONS } from "@/lib/public-site/site-data";
import { getAllPosts } from "@/lib/public-site/posts";

export const revalidate = 300;

export default async function HomePage() {
  const posts = (await getAllPosts()).slice(0, 3);

  return (
    <>
      <HomeHero />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
          <SectionHeading
            eyebrow="Our approach"
            title="The Three Phases of Wealth"
            description="Our comprehensive, proactive approach ensures we address your financial goals and objectives, using the most efficient methods available."
          />
          <p className="text-muted-foreground lg:pb-1">
            Strategic Income Group not only has the expertise to offer financial advice, but it has services to help facilitate the appropriate
            actions we recommend to our clients. We’ll construct a plan to help you achieve your goals utilizing one or several of our core services
            to keep you on track toward a meaningful and purpose-driven financial future.
          </p>
        </div>
        <div className="mt-12">
          <PhaseCards />
        </div>
        <div className="mt-8">
          <ButtonLink label="Learn More" href="/our-approach" variant="outline" />
        </div>
      </Section>

      <Section tone="navy">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">Impact Goal</p>
            <p className="mt-5 font-serif text-3xl leading-snug sm:text-4xl">{IMPACT_GOAL}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { k: "25,000", v: "people educated & inspired" },
              { k: "$1B+", v: "charitable & impact investing" },
              { k: "2013", v: "serving families since" },
              { k: "2", v: "Valley offices · Chandler & Peoria" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <p className="font-serif text-3xl text-brand-gold">{s.k}</p>
                <p className="mt-1 text-sm text-white/65">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="Strategic Income Group Services"
            title="Solutions for every season"
            description="At Strategic Income Group, we recognize that managing substantial wealth can be both a blessing and a challenge."
          />
          <ButtonLink label="View Services" href="/services" variant="outline" />
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <Link key={s.title} href={s.href} className="group bg-card p-7 transition-colors hover:bg-muted/60">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-primary">
                <SiteIcon name={s.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-serif text-2xl">{s.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Learn More <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <PlannerGrid />

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-brand-gold/30 to-transparent blur-xl" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/team/michael-gauthier.webp" alt="Mike Gauthier, CFP®" className="relative aspect-[4/5] w-full rounded-2xl border object-cover object-top" />
          </div>
          <div>
            <SectionHeading eyebrow="Meet our CEO" title="Mike Gauthier" description="Founder & CEO of Strategic Income Group" />
            <p className="mt-6 leading-relaxed text-muted-foreground">{CEO_BIO}</p>
            <blockquote className="mt-6 flex gap-3 rounded-xl border bg-muted/40 p-5 text-sm italic text-muted-foreground">
              <Quote className="h-5 w-5 shrink-0 text-gold" />
              In the same way, let your light shine before others, that they may see your good deeds and glorify your father in heaven. — Matthew 5:16
            </blockquote>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink label="CEO Profile" href="/team/michael-gauthier" />
              <ButtonLink label="Meet Our Team" href="/team" variant="outline" />
            </div>
          </div>
        </div>
      </Section>

      {posts.length ? (
        <Section tone="muted">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="Resources" title="Strategic Insights" description="Financial planning resources, investment, trusts and retirement planning articles." />
            <ButtonLink label="All resources" href="/resources" variant="outline" />
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </Section>
      ) : null}

      <CtaBand />
    </>
  );
}
