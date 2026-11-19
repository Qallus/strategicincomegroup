import { Car, HeartPulse, Home, Layers, Shield, Umbrella } from "lucide-react";
import { ButtonLink, CtaBand, PageHero, PlannerGrid, Section, SectionHeading } from "@/components/public-site/blocks";

export const metadata = {
  title: "Insurance Planning",
  description:
    "Safeguard your wealth with strategic protection. Tailored, cost-effective life, disability, home and auto coverage reviews from Strategic Income Group.",
};

const TYPES = [
  { icon: HeartPulse, label: "Life" },
  { icon: Shield, label: "Disability" },
  { icon: Home, label: "Homeowners / Renters" },
  { icon: Car, label: "Auto" },
  { icon: Umbrella, label: "Umbrella" },
  { icon: Layers, label: "Health" },
];

export default function InsurancePlanningPage() {
  return (
    <>
      <PageHero
        eyebrow="SIG Services · Insurance Planning"
        title="Safeguarding Your Wealth with Strategic Protection"
        accent="Strategic Protection"
        breadcrumb={[{ label: "Solutions", href: "/services" }, { label: "Insurance Planning" }]}
        description="At Strategic Income Group, we believe that a solid insurance plan is essential to protecting your wealth and legacy. In alignment with the second step of the Foundation Phase, we help transfer financial risk away from you and your family by providing tailored, cost-effective insurance solutions."
        actions={[{ label: "Schedule Online", href: "/book" }, { label: "Contact Us", href: "/contact" }]}
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Coverage" title="Get the Right Coverage to Protect Your Future" />
            <p className="mt-5 leading-relaxed text-muted-foreground">
              From life insurance to disability coverage, we ensure that insurance companies compete for your business to deliver the best value. In
              addition, we collaborate with your home and auto insurance providers to review and ensure you have appropriate coverage across all
              areas.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We focus on affordable, effective coverage that protects your family without burdening you with unnecessary costs. Unlike others who
              may push expensive policies for higher commissions, our goal is to find the right coverage that supports your plan and frees up
              resources for what truly matters—your future, your legacy, and making a positive impact in the world.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {TYPES.map((t) => (
              <div key={t.label} className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
                <t.icon className="h-7 w-7 text-gold" />
                <span className="text-sm font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <SectionHeading eyebrow="Consultation" title="Schedule an SIG Consultation Call" />
            <p className="mt-5 leading-relaxed text-muted-foreground">
              During our consultation, we’ll look at your entire financial picture and make recommendations for each policy type including how much
              insurance you need, how long you’ll need it, and why you need it.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We can also help you stack policies together so that you can get the life insurance you need while saving money at the same time. The
              savings can be used in a variety of ways, but one excellent choice is to invest the money for the future. This strategy is likely to
              result in a much better financial position whether or not the life insurance is actually used—something that differentiates us from
              many other insurance planners.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-8">
            <p className="font-serif text-2xl">Ready to review your coverage?</p>
            <p className="mt-2 text-sm text-muted-foreground">Let us help you get the insurance appropriate for you and your family.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink label="Schedule Online" href="/book" />
              <ButtonLink label="Learn More" href="/contact" variant="outline" />
            </div>
          </div>
        </div>
      </Section>

      <PlannerGrid tone="default" />
      <CtaBand />
    </>
  );
}
