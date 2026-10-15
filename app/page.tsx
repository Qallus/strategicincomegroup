import Link from "next/link";
import { ArrowRight, Compass, HandHeart, LineChart, Phone } from "lucide-react";
import { SiteShell } from "@/components/public-site/site-shell";

// Step 1 placeholder home page. Step 2 replaces this with the full rebuild of
// strategicincomegroup.com (Solutions, Team, Three Phases of Wealth, Events, etc.).

const PILLARS = [
  { n: "01", title: "Strategize", copy: "Build a plan with purpose around your goals, values, family, and future.", icon: Compass },
  { n: "02", title: "Invest", copy: "Align your investments with your plan, income needs, risk tolerance, and long-term objectives.", icon: LineChart },
  { n: "03", title: "Give", copy: "Create a lasting legacy through generosity, family impact, and purpose-driven planning.", icon: HandHeart },
];

export default function HomePage() {
  return (
    <SiteShell contentClassName="w-full">
      <section className="relative overflow-hidden bg-brand-navy-deep text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-gold/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1160px] px-8 py-24 sm:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">Strategic Income Group</p>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[1.05] sm:text-6xl">
            Financial Solutions for <span className="italic text-brand-gold">Every Phase</span> of Life
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/75">
            A comprehensive, proactive approach to your financial goals, with the expertise to advise and the services to
            help you act on that advice.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-navy-deep transition hover:brightness-110"
            >
              Schedule a consultation <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="tel:+14804667070"
              className="inline-flex items-center gap-2 rounded-md border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Phone className="h-4 w-4" /> (480) 466-7070
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1160px] gap-6 px-8 py-20 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.n} className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="font-serif text-3xl text-brand-gold">{p.n}</span>
              <p.icon className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h2 className="mt-4 font-serif text-2xl">{p.title}</h2>
            <p className="mt-2 text-muted-foreground">{p.copy}</p>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
