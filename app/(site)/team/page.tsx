import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink, CtaBand, PageHero, PlannerGrid, Section, SectionHeading } from "@/components/public-site/blocks";
import { getAdminTeam, getCeo } from "@/lib/team/data";
import { CEO_BIO } from "@/lib/public-site/site-data";

export const revalidate = 300;

export const metadata = {
  title: "Our Team",
  description:
    "Meet the Strategic Income Group financial planners and team in our Chandler and Peoria, Arizona offices — credentialed CFP® professionals ready to listen.",
};

export default async function TeamPage() {
  const [CEO, ADMIN_TEAM] = await Promise.all([getCeo(), getAdminTeam()]);
  return (
    <>
      <PageHero
        eyebrow="Our Team"
        title="Meet Our Financial Planners"
        accent="Financial Planners"
        breadcrumb={[{ label: "About Us" }, { label: "Our Team" }]}
        description="Strategic Income Group has an award-winning team of financial planners ready to listen to your needs and provide superior solutions. Our Financial Planners in the Chandler and Peoria, Arizona offices are credentialed and provide financial planning in conjunction with our comprehensive array of services."
        actions={[
          { label: "Schedule a Consultation", href: "/get-started" },
          { label: "Meet Our Entire Team", href: "#entire-team" },
        ]}
      />

      <Section className="!pb-0">
        <p className="max-w-3xl rounded-xl border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
          Individuals certified by the CFP® Board have taken the extra step to demonstrate their professionalism by voluntarily submitting to the
          rigorous CFP® certification process that includes ongoing education, examination, experience, and ethical requirements.
        </p>
      </Section>

      <PlannerGrid tone="default" eyebrow="Financial planners" title="Book time with a planner" />

      {CEO ? (
      <Section tone="muted">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <SectionHeading eyebrow="Founder & CEO of Strategic Income Group" title={CEO.name} />
            <p className="mt-5 leading-relaxed text-muted-foreground">{CEO_BIO}</p>
            <div className="mt-8">
              <ButtonLink label="CEO Profile" href={`/team/${CEO.slug}`} />
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {CEO.photo ? <img src={CEO.photo} alt={CEO.name} className="mx-auto aspect-[4/5] w-full max-w-sm rounded-2xl border object-cover object-top" /> : null}
        </div>
      </Section>
      ) : null}

      <Section id="entire-team">
        <SectionHeading eyebrow="Strategic Income Group" title="Administrative Team" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_TEAM.map((m) => (
            <Link key={m.slug} href={`/team/${m.slug}`} className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md">
              {m.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg border object-cover object-top" />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted font-serif text-2xl text-muted-foreground">{m.name.charAt(0)}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-lg leading-tight">
                  {m.name}
                  {m.credentials ? <span className="text-sm text-gold">, {m.credentials}</span> : null}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{m.title}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <SectionHeading
            eyebrow="Join Our Team"
            title="How To Join SIG"
            description="We have designed a multi-step process that allows us to get to know you while giving you an opportunity to understand our culture, expectations, and career paths."
          />
          <ButtonLink label="Start Your Application Here" href="/join-our-team" />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
