import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand, PageHero, PlannerGrid, Section } from "@/components/public-site/blocks";
import { SiteIcon } from "@/components/public-site/icons";
import { SOLUTIONS } from "@/lib/public-site/site-data";

export const metadata = {
  title: "Financial Solutions",
  description: "Financial planning, investment management, estate, insurance and tax planning designed to help clients achieve greater financial security.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Financial Solutions"
        accent="Solutions"
        breadcrumb={[{ label: "Solutions" }]}
        description="Each of our services listed below are designed to help our clients achieve a greater degree of financial security."
        actions={[{ label: "Get Started", href: "/get-started" }, { label: "Our Approach", href: "/our-approach" }]}
      />

      <Section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <Link key={s.title} href={s.href} className="group flex flex-col rounded-xl border bg-card p-7 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background text-primary">
                <SiteIcon name={s.icon} className="h-6 w-6" />
              </span>
              <h2 className="mt-6 font-serif text-2xl">{s.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Learn More <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <PlannerGrid />
      <CtaBand />
    </>
  );
}
