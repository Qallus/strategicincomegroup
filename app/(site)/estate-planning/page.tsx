import { FileLock2 } from "lucide-react";
import { CtaBand, PageHero, PlannerGrid, Section, SectionHeading } from "@/components/public-site/blocks";
import { EstatePricing } from "@/components/public-site/estate-pricing";

export const metadata = {
  title: "Estate Planning",
  description:
    "Protect your legacy and make a lasting impact. Will and trust based estate plans, powers of attorney and document reviews from Strategic Income Group.",
};

export default function EstatePlanningPage() {
  return (
    <>
      <PageHero
        eyebrow="Estate Planning Services"
        title="Protect Your Legacy and Make a Lasting Impact"
        accent="Lasting Impact"
        breadcrumb={[{ label: "Solutions", href: "/services" }, { label: "Estate Planning" }]}
        description="Estate planning is the crucial third step in the Foundation Phase of building lasting wealth and impact. At Strategic Income Group, we believe that estate planning is about more than asset protection—it’s about creating a legacy that reflects your values, safeguards your loved ones, and allows your wealth to make a positive difference for generations to come."
        actions={[{ label: "Schedule a Consultation", href: "/get-started" }, { label: "Phase I", href: "/phase-1-2" }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            eyebrow="Why it matters"
            title="Ensure your wishes are carried out with precision"
            description="Our services are designed to help you structure your estate, handle life’s unexpected emergencies, and ensure your wishes are carried out with precision."
          />
          <p className="leading-relaxed text-muted-foreground">
            Having the right Powers of Attorney—for medical and financial decisions—ensures that your loved ones can manage emergencies and critical
            decisions on your behalf when you are unable to do so. These documents are an essential part of protecting your family’s future and
            ensuring your intentions are honored in all situations.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Pricing" title="Service Menu" description="Transparent pricing for SIG clients and non-clients." />
        <div className="mt-10">
          <EstatePricing />
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 rounded-2xl border bg-card p-8 sm:p-12 lg:grid-cols-[auto_1fr] lg:items-center">
          <FileLock2 className="h-12 w-12 text-gold" />
          <div>
            <h2 className="font-serif text-3xl">“Prepare Today for Peace of Mind Tomorrow”</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
              We’ll help you identify and securely archive your most important documents—before life’s unexpected events like injury, disability, or
              loss. Protect your loved ones by ensuring everything is organized and easily accessible when it matters most.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Disclosure: We work with EncorEstate Plans, Certified Legal Document Preparers, and Attorneys to provide the best estate planning
              services. Together, we’ll create a customized plan that fits your family’s unique needs while being mindful of cost-effectiveness.
            </p>
          </div>
        </div>
      </Section>

      <PlannerGrid />
      <CtaBand />
    </>
  );
}
