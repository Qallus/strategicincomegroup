import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand, PageHero, PhaseCards, Section, SectionHeading } from "@/components/public-site/blocks";
import { SiteIcon } from "@/components/public-site/icons";
import { SOLUTIONS } from "@/lib/public-site/site-data";

export const metadata = {
  title: "Our Approach",
  description:
    "The Three Phases of Wealth, developed by Michael Gauthier, CFP®, is an effective financial planning process that gives order to financial goals.",
};

export default function OurApproachPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Approach"
        title="Welcome To Strategic Income Group!"
        accent="Strategic Income Group"
        breadcrumb={[{ label: "About Us" }, { label: "Our Approach" }]}
        description={
          <>
            <p>
              Strategic Income Group offers a variety of financial services designed to help you reach your goals. We strive to be your premier
              financial resource for everything you need.
            </p>
            <p className="mt-4">
              Our team of financial professionals is abundantly equipped to address your financial concerns, complications, and unique situation.
              Our comprehensive approach and credentials are what makes us stand out from the rest.
            </p>
          </>
        }
        actions={[{ label: "Contact SIG Today", href: "/contact" }, { label: "Schedule Meeting", href: "/get-started" }]}
      />

      <Section>
        <SectionHeading
          eyebrow="The Three Phases of Wealth"
          title="Take a look at these phases and see where you should begin"
          description="The Three Phases of Wealth, developed by our very own Michael Gauthier, CFP®, is an effective financial planning process that gives order to financial goals and encourages proper money management."
        />
        <div className="mt-12">
          <PhaseCards />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="How We Can Help You"
          title="Services for each phase"
          description="Our comprehensive array of financial services can help you in each phase of the Three Phases of Wealth. Here’s a summary of what we have to offer:"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {SOLUTIONS.slice(0, 4).map((s) => (
            <Link key={s.title} href={s.href} className="group flex gap-5 rounded-xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                <SiteIcon name={s.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-serif text-2xl">{s.title}</span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{s.summary}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Read More <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
