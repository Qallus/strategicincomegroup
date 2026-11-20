import { MapPin } from "lucide-react";
import { ButtonLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/public-site/blocks";
import { CareersRoles, type RoleCard } from "@/components/public-site/careers-roles";
import { getLiveJobs } from "@/lib/careers/server";
import { groupJobs, hasJobDetail } from "@/lib/careers/shared";
import { WHY_SIG } from "@/lib/public-site/careers";
import { OFFICES } from "@/lib/public-site/site-data";

export const metadata = {
  title: "Careers — Join Our Team",
  description:
    "At Strategic Income Group we believe work is more than just a job—it’s a calling. Explore careers in financial planning, client service and operations.",
};

// Listings come from Dashboard → Job Postings (falls back to lib/public-site/careers.ts).
export const revalidate = 300;

export default async function CareersPage() {
  const jobs = await getLiveJobs();
  const openCount = jobs.filter((j) => j.hiring_status === "open").length;
  const groups = groupJobs(jobs).map((g) => ({
    heading: g.heading,
    roles: g.jobs.map<RoleCard>((j) => ({
      slug: j.slug,
      title: j.title,
      summary: j.summary,
      department: j.department,
      badge: j.badge_text,
      open: j.hiring_status === "open",
      featured: j.featured,
      hasDetail: hasJobDetail(j),
      location: j.location,
      employmentType: j.employment_type,
    })),
  }));

  return (
    <>
      <PageHero
        eyebrow="Build a Career with Purpose"
        title="Join Our Team"
        accent="Our Team"
        breadcrumb={[{ label: "About Us" }, { label: "Careers" }]}
        description="At Strategic Income Group (SIG), we believe that work is more than just a job—it’s a calling. We exist to serve our clients with integrity, wisdom, and excellence, helping them become better stewards of their financial resources. Our team is made up of high-quality, high-character professionals who are passionate about making a difference in people’s lives while upholding our mission, vision, and core values."
        actions={[{ label: "Career Application", href: "/contact?topic=careers" }, { label: "Contact SIG", href: "/contact" }]}
        aside={
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-8 text-center backdrop-blur">
            <span className="inline-block rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold text-[hsl(225_80%_10%)]">Now Hiring</span>
            <p className="mt-4 font-serif text-5xl">Careers</p>
            <p className="mx-auto mt-3 max-w-xs text-white/75">Work that is more than just a job—it’s a calling.</p>
            <p className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold font-semibold text-[hsl(225_80%_10%)]">{openCount}</p>
            <p className="mt-2 font-semibold">Positions Available</p>
            <div className="mt-6 grid gap-2 text-left text-sm text-white/70">
              {OFFICES.map((o) => (
                <p key={o.name} className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-gold" /> SIG {o.name} · {o.city}
                </p>
              ))}
            </div>
          </div>
        }
      />

      <Section>
        <SectionHeading eyebrow="Why Work at SIG" title="More than a paycheck" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {WHY_SIG.map((w, i) => (
            <div key={w.title} className="rounded-xl border bg-card p-6">
              <span className="font-serif text-3xl text-gold">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-serif text-xl leading-snug">{w.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="The Roles We Offer"
          title="We are always seeking top-tier professionals"
          description="We actively build a waitlist of qualified candidates for immediate and future opportunities."
        />
        <div className="mt-10">
          <CareersRoles groups={groups} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 rounded-2xl border bg-card p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <SectionHeading
            eyebrow="How To Join SIG"
            title="More Than Just a Paycheck"
            description="If you’re looking for more than just a paycheck—if you want to be part of a team that is committed to serving others, growing together, and striving for excellence—then we want to hear from you. Whether we are currently hiring for your ideal role or not, we are always looking to connect with top-tier talent who align with our culture."
          />
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We have designed a multi-step process that allows us to get to know you while giving you an opportunity to understand our culture,
              expectations, and career paths.
            </p>
            <ButtonLink label="Apply For a Career Today" href="/contact?topic=careers" />
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
