import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CtaBand, NumberedSteps, PageHero, PhaseCards, PlannerGrid, Section, SectionHeading } from "@/components/public-site/blocks";

export type PhaseStep = { label?: string; title: string; body: React.ReactNode };

/** Shared layout for the three "Three Phases of Wealth" pages. */
export function PhasePage({
  numeral,
  name,
  href,
  intro,
  stepsTitle,
  stepsIntro,
  steps,
  prev,
  next,
  aside,
}: {
  numeral: string;
  name: string;
  href: string;
  intro: string;
  stepsTitle: string;
  stepsIntro: string;
  steps: PhaseStep[];
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
  aside?: React.ReactNode;
}) {
  return (
    <>
      <PageHero
        eyebrow={`Phase ${numeral}`}
        title={name}
        accent={name.replace(/^The /, "").replace(/ Phase$/, "")}
        breadcrumb={[{ label: "Our Approach", href: "/our-approach" }, { label: `Phase ${numeral}` }]}
        description={intro}
        actions={[
          { label: "Schedule a Consultation", href: "/get-started" },
          ...(next ? [{ label: next.label, href: next.href }] : [{ label: "Meet our Planners", href: "/team" }]),
        ]}
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading eyebrow={`Phase ${numeral}`} title={stepsTitle} description={stepsIntro} />
            <div className="mt-8 flex flex-wrap gap-3">
              {prev ? (
                <Link href={prev.href} className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted">
                  <ArrowLeft className="h-4 w-4" /> {prev.label}
                </Link>
              ) : null}
              {next ? (
                <Link href={next.href} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
                  {next.label} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
            {aside}
          </div>
          <NumberedSteps steps={steps} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="The Three Phases of Wealth" title="Where are you on the journey?" />
        <div className="mt-10">
          <PhaseCards current={href} />
        </div>
      </Section>

      <PlannerGrid tone="default" eyebrow="Meet our Investment Professionals" title="Talk it through with a planner" description="Sit down with one of our investment professionals at least once a year (preferably 2-4 times) to review your investment performance and build a customized portfolio that is right for you." />

      <CtaBand />
    </>
  );
}
