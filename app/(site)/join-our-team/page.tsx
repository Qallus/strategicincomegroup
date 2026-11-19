import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { ButtonLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/public-site/blocks";
import { OPEN_POSITIONS, ROLE_GROUPS, WHY_SIG } from "@/lib/public-site/careers";
import { OFFICES } from "@/lib/public-site/site-data";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Careers — Join Our Team",
  description:
    "At Strategic Income Group we believe work is more than just a job—it’s a calling. Explore careers in financial planning, client service and operations.",
};

const openCount = OPEN_POSITIONS;

export default function CareersPage() {
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
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {ROLE_GROUPS.map((g) => (
            <div key={g.heading}>
              <h3 className="font-serif text-2xl">{g.heading}</h3>
              <ul className="mt-5 space-y-3">
                {g.roles.map((r) => {
                  const body = (
                    <>
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-medium">{r.title}</span>
                        {r.status ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              r.status === "Part-Time" ? "bg-[hsl(219_68%_54%/0.15)] text-[hsl(219_60%_40%)] dark:text-brand-sky" : "bg-[hsl(147_27%_43%/0.15)] text-[hsl(147_35%_30%)] dark:text-brand-sage",
                            )}
                          >
                            {r.status}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{r.summary}</span>
                      {r.slug ? (
                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          View role <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={r.title}>
                      {r.slug ? (
                        <Link href={`/join-our-team/${r.slug}`} className="group block rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md">
                          {body}
                        </Link>
                      ) : (
                        <div className="rounded-xl border border-dashed bg-card/60 p-4">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
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
