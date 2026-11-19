import Link from "next/link";
import { CalendarDays, Clock, Mail, MessageSquare, Phone } from "lucide-react";
import { Container, PageHero, PhaseCards, Section, SectionHeading } from "@/components/public-site/blocks";
import { CONTACT } from "@/lib/public-site/site-data";

export const metadata = {
  title: "Get Started",
  description: "Get started with a Certified Financial Planner® & Wealth Advisor. Schedule your free consultation today.",
};

const STEPS = [
  { n: "01", title: "Book a free consultation", copy: "Choose a time that works for you—in person in Chandler or Peoria, or over the phone." },
  { n: "02", title: "Share your goals", copy: "We start by listening to your financial concerns, needs, and questions." },
  { n: "03", title: "Get a plan with purpose", copy: "We build your plan around the Three Phases of Wealth and help you put it into action." },
];

export default function GetStartedPage() {
  return (
    <>
      <PageHero
        eyebrow="Get Started"
        title="Talk to an Expert Planner Today"
        accent="Expert Planner"
        breadcrumb={[{ label: "Get Started" }]}
        description="Get started with a Certified Financial Planner® & Wealth Advisor. Schedule your appointment today with just a couple of clicks."
        actions={[{ label: "Schedule Free Consultation", href: "/book" }, { label: CONTACT.phone, href: CONTACT.phoneHref }]}
      />

      <Container className="-mt-10 relative z-10">
        <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xl shadow-black/5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CalendarDays, label: "Schedule online", value: "Pick a time", href: "/book" },
            { icon: Phone, label: "Call us", value: CONTACT.phone, href: CONTACT.phoneHref },
            { icon: Mail, label: "Email us", value: CONTACT.generalEmail, href: `mailto:${CONTACT.generalEmail}` },
            { icon: Clock, label: "We're open", value: CONTACT.hours },
          ].map((c) => {
            const inner = (
              <>
                <c.icon className="h-5 w-5 text-gold" />
                <span className="mt-3 block text-xs uppercase tracking-[0.14em] text-muted-foreground">{c.label}</span>
                <span className="mt-1 block break-words text-sm font-semibold">{c.value}</span>
              </>
            );
            return c.href ? (
              <Link key={c.label} href={c.href} className="rounded-xl p-4 transition hover:bg-muted">{inner}</Link>
            ) : (
              <div key={c.label} className="rounded-xl p-4">{inner}</div>
            );
          })}
        </div>
      </Container>

      <Section>
        <SectionHeading align="center" eyebrow="How it works" title="Three simple steps" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border bg-card p-7">
              <span className="font-serif text-4xl text-gold">{s.n}</span>
              <h3 className="mt-3 font-serif text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.copy}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/book" className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <CalendarDays className="h-4 w-4" /> Schedule Free Consultation
          </Link>
          <Link href="/contact" className="inline-flex h-11 items-center gap-2 rounded-md border px-6 text-sm font-semibold hover:bg-muted">
            <MessageSquare className="h-4 w-4" /> Send a message
          </Link>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="The Three Phases of Wealth" title="Not sure where to begin?" description="Take a look at these phases and see where you should begin." />
        <div className="mt-10">
          <PhaseCards />
        </div>
      </Section>
    </>
  );
}
