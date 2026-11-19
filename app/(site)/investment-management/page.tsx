import { Ban, HandHeart, LineChart, Megaphone, Rocket, Scale, ShieldHalf, Sparkles } from "lucide-react";
import { ButtonLink, CtaBand, PageHero, PlannerGrid, Section, SectionHeading } from "@/components/public-site/blocks";

export const metadata = {
  title: "Investment Management",
  description:
    "Full-featured investment management: diversified public and private investments, impact alignment through Avoid, Amplify & Advance, and tax-efficient strategies.",
};

const FEATURES = [
  { icon: LineChart, title: "Real-Time Portfolio Recommendations", copy: "We strive to deliver market-rate returns by investing in a diversified portfolio of public and private investments, including private equity, private real estate, and alternative assets, tailored to each client’s financial plan." },
  { icon: Sparkles, title: "Maximize Impact", copy: "Through our Avoid, Amplify & Advance framework, we focus on aligning investments with values that create a lasting, positive impact in the world, all while meeting financial objectives." },
  { icon: ShieldHalf, title: "Minimize Risk", copy: "By leveraging sophisticated strategies such as hedging, private credit, and comprehensive risk management, we aim to reduce portfolio volatility while preserving capital." },
  { icon: Scale, title: "Minimize Taxes", copy: "Our tax-efficient strategies, including tax loss harvesting, Donor-Advised Funds, and Qualified Charitable Distributions, help clients minimize tax liabilities while maximizing after-tax returns and impact." },
];

const AAA = [
  { icon: Ban, title: "Avoid", subtitle: "Excluding What Doesn’t Align", copy: "We begin by identifying and excluding investments that don’t align with our core values. Through negative screening, we strive to avoid sectors and companies involved in harmful or unethical practices. While we work to exclude such investments, it’s important to note that perfect alignment with all criteria is not always guaranteed." },
  { icon: Megaphone, title: "Amplify", subtitle: "Strengthening Positive Investments", copy: "Next, we focus on amplifying investments that contribute to positive outcomes in society. We seek to include companies and opportunities that reflect strong ethical practices and a commitment to community impact, using custom indexing aligned with our values." },
  { icon: Rocket, title: "Advance", subtitle: "Encouraging Long-Term Impact", copy: "Finally, we seek to advance long-term, positive change through investments that reflect our commitment to fostering a better future—selecting investments that promote social good, ethical governance, and community development." },
];

export default function InvestmentManagementPage() {
  return (
    <>
      <PageHero
        eyebrow="Investment Management"
        title="Expect More From Your Investments"
        accent="More"
        breadcrumb={[{ label: "Solutions", href: "/services" }, { label: "Investment Management" }]}
        description="It takes a tremendous amount of time and resources to manage investments. Strategic Income Group is here to help!"
        actions={[{ label: "Get Started", href: "/get-started" }, { label: "Contact Us", href: "/contact" }]}
      />

      <Section>
        <SectionHeading eyebrow="Investment Management" title="Full-Featured Investment Management Services" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-7">
              <f.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 font-serif text-2xl">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{f.copy}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-5 rounded-xl border bg-muted/40 p-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h3 className="font-serif text-2xl">Investment Review</h3>
            <p className="mt-2 text-muted-foreground">
              Throughout the process, we’ll review your investments in light of your financial plan. We have tools that will help us determine if
              your investment portfolio is on track and will adjust allocations accordingly.
            </p>
          </div>
          <ButtonLink label="Contact Us" href="/contact" />
        </div>
      </Section>

      <Section tone="navy">
        <SectionHeading
          invert
          eyebrow="Investment Management"
          title="SIG's Impact Investment Strategy"
          description="We believe that investments should strive to do more than just generate returns—they should have a meaningful impact on the world while aligning with our values. While many investment advisors focus exclusively on risk, return, and taxes, we take it a step further by asking: How do your investments impact the communities we live in?"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {AAA.map((a) => (
            <div key={a.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-7">
              <a.icon className="h-6 w-6 text-brand-gold" />
              <h3 className="mt-4 font-serif text-3xl">{a.title}</h3>
              <p className="text-sm font-medium text-brand-gold">{a.subtitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-white/70">{a.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Ongoing Research & Due Diligence" title="A rigorous 90-day review process" />
            <p className="mt-5 leading-relaxed text-muted-foreground">
              In 2008, CEO Mike Gauthier began a rigorous 90-day review process, where every quarter, 8-10 investment managers present their firm’s
              research, views, and products. This process fosters competition, ensuring we are always seeking out the best opportunities. Mike
              carried this review process over to Strategic Income Group when he founded the firm in 2013, and it continues to this day.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Members of our investment committee attend multiple conferences across the U.S. each year to stay on the cutting edge of impact
              investing. Clients are welcome to attend these meetings to observe our thorough evaluation process.
            </p>
            <h3 className="mt-8 font-serif text-2xl">Balancing Risk, Return, and Impact</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Our goal is to provide value by balancing risk, return, and impact. We charge fees based on the assets we manage, ensuring our success
              is tied to yours. We strive to lower risk, maximize after-tax returns, and create positive impact, all while aligning with our core
              values.
            </p>
          </div>
          <div className="space-y-5">
            <div className="rounded-xl border bg-card p-7">
              <LineChart className="h-6 w-6 text-gold" />
              <h3 className="mt-3 font-serif text-2xl">Sophisticated Strategies for Optimized Returns</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="font-semibold">Tax Loss Harvesting</dt><dd className="text-muted-foreground">Reducing taxable gains and maximizing retained wealth.</dd></div>
                <div><dt className="font-semibold">Alternative Investments</dt><dd className="text-muted-foreground">Providing access to private credit, private equity, and private real estate to complement traditional portfolios.</dd></div>
                <div><dt className="font-semibold">Hedging Strategies</dt><dd className="text-muted-foreground">Managing portfolio risk through advanced techniques.</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border bg-card p-7">
              <HandHeart className="h-6 w-6 text-gold" />
              <h3 className="mt-3 font-serif text-2xl">Charitable Solutions for Maximized Impact</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="font-semibold">Donor-Advised Funds (DAFs)</dt><dd className="text-muted-foreground">Simplifying philanthropy and potentially reducing taxes.</dd></div>
                <div><dt className="font-semibold">Qualified Charitable Distributions (QCDs)</dt><dd className="text-muted-foreground">Providing tax-efficient ways to give directly from retirement accounts.</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </Section>

      <PlannerGrid eyebrow="Meet With Our Investment Professionals" title="Review your portfolio with us" description="Sit down with one of our investment professionals at least once a year (preferably 2-4 times) to review your investment performance and manage your portfolio with strategic and tactical rebalancing when required by the market." />
      <CtaBand />
    </>
  );
}
