import { Church, HandCoins, Landmark, ListChecks, Mail, Phone, PiggyBank, Users } from "lucide-react";
import { ButtonLink, CheckList, CtaBand, PageHero, Section, SectionHeading } from "@/components/public-site/blocks";
import { CONTACT } from "@/lib/public-site/site-data";

export const metadata = {
  title: "403(b) Plans for Churches",
  description:
    "Kingdom Stewardship 403(b) plans: faith-based retirement plans for church leaders and nonprofit staff, aligned with biblical values.",
};

const BENEFITS = [
  { icon: Church, title: "Designed for Churches", copy: "Created specifically for churches and nonprofit ministries, offering flexibility not typically available in traditional corporate retirement plans." },
  { icon: PiggyBank, title: "Tax-Advantaged Growth", copy: "Pre-tax or Roth contributions let pastors and staff set aside savings for the future while aligning with your ministry’s benefits structure." },
  { icon: Users, title: "Stronger Staff Retention", copy: "A well-structured retirement benefit helps you care for, keep and equip the people who serve your congregation." },
  { icon: HandCoins, title: "Contribution Options", copy: "Includes employee deferrals, employer matching, and additional catch-up contributions available to long-serving church employees." },
  { icon: Landmark, title: "Values-Aligned", copy: "Faith-based and biblically responsible investment choices can align retirement savings with your church’s beliefs." },
  { icon: ListChecks, title: "Simple Administration", copy: "Church 403(b) plans often have streamlined compliance requirements compared to other retirement plan structures." },
];

const TOPICS = [
  {
    title: "The Compass Case Study",
    items: ["How Compass evaluated and aligned its 403(b) plan", "Leadership considerations and fiduciary responsibility", "Ensuring retirement planning reflects biblical conviction"],
  },
  {
    title: "Faith-Based Investing Today",
    items: ["What “faith-aligned” investing actually means", "Addressing the common concern about performance", "Why biblical alignment and strong long-term outcomes are not mutually exclusive"],
  },
  {
    title: "Strengthening Stewardship In Your Church",
    items: ["Aligning retirement plans with mission", "Educating and equipping staff", "Developing a congregational stewardship pathway", "Practical next steps for church leadership"],
  },
];

export default function Plan403bPage() {
  return (
    <>
      <PageHero
        eyebrow="Kingdom Stewardship 403(b) Plan"
        title="Faith-Based Retirement Plans for Church Leaders"
        accent="Church Leaders"
        breadcrumb={[{ label: "Solutions", href: "/services" }, { label: "403(b)" }]}
        description="Your church pours into others every week. A properly structured 403(b) plan allows you to pour into your team—helping pastors and staff build long-term financial security while staying aligned with your biblical values and organizational goals."
        actions={[{ label: "Get Started", href: "/contact?topic=403b" }, { label: "Learn More", href: "#benefits" }]}
      />

      <Section id="benefits">
        <SectionHeading
          eyebrow="Key Benefits"
          title="Why a 403(b) Plan Makes Sense for Churches"
          description="A 403(b) retirement plan is specifically built for churches and nonprofit organizations. It provides tax advantages, flexible contribution options, and simplified administration—so your team can prepare for retirement without unnecessary complexity. Whether you’re launching a new plan or reviewing an existing one, the right structure can strengthen retention, protect compliance, and reinforce stewardship across your ministry."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border bg-card p-6">
              <b.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 font-serif text-xl">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="navy">
        <div className="grid gap-12 lg:grid-cols-2">
          <SectionHeading
            invert
            eyebrow="A Framework For Stewardship"
            title="Why a Clear Stewardship Framework Strengthens Both Staff and Congregation"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm font-semibold text-brand-gold">The Three Phases of Wealth</p>
              <ol className="mt-3 space-y-2 font-serif text-xl">
                <li>Foundation</li>
                <li>Accumulation</li>
                <li>Strategic Income</li>
              </ol>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm font-semibold text-brand-gold">The Three Phases of Giving</p>
              <ol className="mt-3 space-y-2 font-serif text-xl">
                <li>Tithing</li>
                <li>Impact Giving</li>
                <li>Legacy Giving</li>
              </ol>
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TOPICS.map((t) => (
            <div key={t.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-serif text-2xl">{t.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {t.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" /> {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeading eyebrow="From Christian-Owned to Faith-Based" title="My Story" />
            <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
              <p>
                Kristi and I have been part of Compass Christian Church for over 18 years. We have hosted small groups, taught classes, and walked
                alongside many of you in ministry. I also serve as Chairman of the Board at Valley Christian Schools.
              </p>
              <p>
                A few years ago, during a men’s group, I was convicted that I needed to stop running a Christian-owned business and begin operating a
                truly faith-based business — allowing every financial decision to go through a biblical filter.
              </p>
              <p>
                That conviction led us to examine the investments we were using and ask hard questions about alignment, integrity, and impact. What we
                discovered was encouraging: you do not have to choose between biblical alignment and the rate of return required to accomplish a
                financial plan.
              </p>
            </div>
            <blockquote className="mt-8 border-l-2 border-brand-gold pl-5 font-serif text-2xl leading-snug">
              My personal mission is simple: to encourage and inspire people to use their God-given resources for God-given purposes.
            </blockquote>
          </div>
          <div className="space-y-5">
            <div className="rounded-xl border bg-card p-7">
              <h3 className="font-serif text-2xl">How I Can Support Your Church</h3>
              <CheckList
                className="mt-5"
                items={[
                  "Faith-Based 403(b) Plan Review or Setup",
                  "Retirement Plan Fiduciary Guidance",
                  "Staff Stewardship Education",
                  "Congregational Stewardship Pathway Development",
                  "Elder / Board Presentations",
                  "Kingdom Stewardship Speaking & Workshops",
                ]}
              />
              <p className="mt-5 text-sm italic text-muted-foreground">
                This is not about selling a product. It is about strengthening the church&apos;s ability to steward faithfully.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-7">
              <h3 className="font-serif text-xl">Questions Worth Asking</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Does our retirement plan reflect our biblical convictions?</li>
                <li>Do our staff feel confident and equipped financially?</li>
                <li>Are we discipling generosity intentionally?</li>
                <li>Does our financial structure support our mission long term?</li>
              </ul>
              <p className="mt-3 text-sm">If even one of these questions creates pause — it may be time to explore further.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SectionHeading eyebrow="Let's Continue The Conversation" title="Mike Gauthier" description="Founder | Strategic Income Group" />
            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <a href={CONTACT.phoneHref} className="inline-flex items-center gap-2 hover:text-primary">
                <Phone className="h-4 w-4 text-gold" /> {CONTACT.phone}
              </a>
              <a href="mailto:mike@strategicincomegroup.com" className="inline-flex items-center gap-2 hover:text-primary">
                <Mail className="h-4 w-4 text-gold" /> mike@strategicincomegroup.com
              </a>
            </div>
          </div>
          <ButtonLink label="Interest Form" href="/contact?topic=403b" />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
