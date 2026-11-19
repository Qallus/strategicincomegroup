import Link from "next/link";
import { ArrowRight, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { ButtonLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/public-site/blocks";
import { KidsFedGrid, MealsByPacking, PackingTable } from "@/components/public-site/impact/impact-charts";
import { DestinationCards, ImpactCounters, MilestoneTrail } from "@/components/public-site/impact/impact-sections";
import { PostCard } from "@/components/public-site/post-card";
import { formatPackingDate, formatPackingTime, loadFmscImpact } from "@/lib/impact/fmsc";
import { getAllPosts } from "@/lib/public-site/posts";

export const revalidate = 300;
export const metadata = {
  title: "SIGCares — Feed My Starving Children",
  description:
    "Strategic Income Group clients, family and friends pack meals with Feed My Starving Children in Tempe. See the meals packed, kids fed and countries reached.",
};

const FMSC_URL = "https://www.fmsc.org/locations/tempe-az";

export default async function SigCaresPage() {
  const [impact, posts] = await Promise.all([loadFmscImpact(), getAllPosts()]);
  const stories = posts.filter((p) => p.categories.some((c) => c.slug === "sigcares")).slice(0, 3);
  const next = impact.next;

  return (
    <>
      <PageHero
        eyebrow="SIGCares × Feed My Starving Children"
        title="Hope starts with a meal."
        accent="a meal."
        breadcrumb={[{ label: "Resources", href: "/resources" }, { label: "SIGCares" }]}
        description="Twice a year, Strategic Income Group clients, family and friends roll up their sleeves at Feed My Starving Children in Tempe, packing nutritious meals for children around the world. Here’s what we’ve done together — and where we’re going next."
        actions={[
          ...(next?.href ? [{ label: `RSVP for ${formatPackingDate(next.date, "long")}`, href: next.href }] : [{ label: "See upcoming events", href: "/events" }]),
          { label: "About FMSC", href: "#about-fmsc" },
        ]}
      >
        <div className="mt-10">
          <ImpactCounters impact={impact} tone="navy" />
        </div>
      </PageHero>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            eyebrow="Kids fed for a year"
            title={`${impact.totals.kids.toLocaleString("en-US")} children, one meal at a time.`}
            description="Every figure here is one child fed for a full year by the meals our community packed. Hover a packing to see its share."
          />
          <div className="min-w-0">
            <KidsFedGrid recorded={impact.recorded} />
            <PackingTable recorded={impact.recorded} />
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Every packing"
          title="Meals packed, June and December"
          description="SIG gathers at FMSC Tempe each June and December. Each bar is one packing; the dashed one is next."
        />
        <div className="mt-10 rounded-2xl border bg-card p-5 sm:p-8">
          <MealsByPacking packings={impact.packings} recorded={impact.recorded} rsvpHref={next?.href} />
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Where the meals went"
          title={`${impact.totals.countries} countries, and counting`}
          description="FMSC ships meals to food-distribution partners who stay with communities for the long haul, empowering them to move from relief to development."
        />
        <div className="mt-10">
          <DestinationCards impact={impact} />
        </div>
      </Section>

      <Section tone="navy">
        <SectionHeading
          invert
          eyebrow="The road ahead"
          title="Past 100,000 — and on toward a million meals."
          description="There’s no finish line. We want to keep helping as many children as we can, and leave a lasting impact that outlives any single packing."
        />
        <div className="mt-10">
          <MilestoneTrail impact={impact} tone="navy" />
        </div>
      </Section>

      <Section id="about-fmsc">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading eyebrow="About Feed My Starving Children" title="A Christian nonprofit feeding children in body and spirit." />
            <div className="mt-5 space-y-4 leading-relaxed text-muted-foreground">
              <p>
                Every year, millions of children die from preventable causes such as pneumonia, diarrhea, malaria and undernutrition. Hunger is still
                causing nearly half of deaths in children under 5 years old.
              </p>
              <p>
                Feed My Starving Children (FMSC) believes hope starts with food. FMSC meals are developed by food science and nutrition professionals to
                supplement nutritional needs and reduce problems with malnutrition, so children can grow, thrive and develop to their full potential.
              </p>
            </div>
            <a href={FMSC_URL} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              Visit FMSC Tempe <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Next packing</p>
            {next ? (
              <>
                <p className="mt-2 font-serif text-3xl">{formatPackingDate(next.date, "long")}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-gold" /> {formatPackingTime(next.date)}{next.endDate ? ` – ${formatPackingTime(next.endDate)}` : ""}</li>
                  {next.location ? <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {next.location}</li> : null}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">Clients, family and friends are welcome — first-time volunteers included.</p>
                {next.href ? <ButtonLink label="Reserve your spot" href={next.href} className="mt-6" /> : null}
              </>
            ) : (
              <>
                <p className="mt-2 font-serif text-2xl">Dates for the next packing are coming soon.</p>
                <ButtonLink label="See upcoming events" href="/events" variant="outline" className="mt-6" />
              </>
            )}
          </div>
        </div>
      </Section>

      {stories.length ? (
        <Section tone="muted">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="SIGCares stories" title="From the packing floor" />
            <Link href="/resources?category=sigcares" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              All SIGCares stories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {stories.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </Section>
      ) : null}

      <CtaBand
        title="Join us at the next packing."
        description="Bring your family, friends or colleagues — first-time volunteers are always welcome."
      />
    </>
  );
}
