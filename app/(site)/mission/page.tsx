import { ButtonLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/public-site/blocks";
import { CORE_VALUES } from "@/lib/public-site/site-data";

export const metadata = {
  title: "Mission & Values",
  description:
    "Strategic Income Group empowers individuals to live their best lives and leave a lasting legacy of financial security and positive impact.",
};

export default function MissionPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Mission"
        title="Empowering Individuals to Live Their Best Lives"
        accent="Best Lives"
        breadcrumb={[{ label: "About Us" }, { label: "Mission & Values" }]}
        description="At Strategic Income Group (SIG), we empower individuals to live their best lives and leave a lasting legacy of financial security and positive impact. Through faith-based financial planning, we help clients align their financial resources with Christian values, enabling them to build wealth, give generously, and fulfill their God-given purpose."
        actions={[{ label: "Get Started", href: "/get-started" }, { label: "Meet Our Team", href: "/team" }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            eyebrow="Strategic Income Group Impact Goal"
            title="Our Big Hairy Audacious Goal"
            description="Our Big Hairy Audacious Goal (BHAG) is to educate and inspire 25,000 people to positively transform communities by contributing charitably and making impact investments of $1 billion or more."
          />
          <div className="rounded-2xl border bg-card p-8">
            <p className="text-muted-foreground">
              Through this goal, we aim to create lasting change by empowering individuals and families to use their resources for the good of others,
              sharing the love of Jesus, and making a tangible difference in the world.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-6 border-t pt-6">
              <div>
                <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">People</dt>
                <dd className="mt-1 font-serif text-4xl text-gold">25,000</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Impact</dt>
                <dd className="mt-1 font-serif text-4xl text-gold">$1B+</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading align="center" eyebrow="Our Core Values" title="SIG Core Values" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_VALUES.map((v, i) => (
            <article key={v.title} className="rounded-xl border bg-card p-6">
              <span className="font-serif text-sm text-gold">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-serif text-2xl">{v.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <ButtonLink label="Get Started" href="/get-started" />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
