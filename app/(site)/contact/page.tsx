import Link from "next/link";
import { ArrowDown, ArrowRight, Briefcase, CalendarDays, Clock, Facebook, Linkedin, Mail, Phone } from "lucide-react";
import { Container, PlannerGrid } from "@/components/public-site/blocks";
import { AskSiggyCard } from "@/components/public-site/ask-siggy-card";
import { ContactExperience } from "@/components/public-site/contact-form";
import { OfficeMapCard } from "@/components/public-site/office-map";
import { getLiveJobs } from "@/lib/careers/server";
import { CONTACT, OFFICES } from "@/lib/public-site/site-data";

export const metadata = {
  title: "Contact Us",
  description: "Contact Strategic Income Group to schedule a consultation in person or over the phone. Offices in Chandler and Peoria, Arizona.",
};

type Props = { searchParams: Promise<{ topic?: string; role?: string }> };

export default async function ContactPage({ searchParams }: Props) {
  const { topic, role } = await searchParams;
  const jobs = await getLiveJobs().catch(() => []);
  const openCount = jobs.filter((j) => j.hiring_status === "open").length;
  const positions = [...jobs].sort((a, b) => (a.hiring_status === b.hiring_status ? 0 : a.hiring_status === "open" ? -1 : 1)).map((j) => j.title);
  return (
    <>
      <section className="border-b">
        <Container className="py-16 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Get in touch</p>
          <h1 className="mt-3 font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Let&apos;s start a <em className="text-gold">conversation.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Whether you&apos;re planning for the first time, a current client with a request, a church exploring a 403(b), or ready to join our
            team, tell us what you need. Contact us to schedule a consultation – either in-person or over the phone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#contact-form" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Send us a message <ArrowDown className="h-4 w-4" />
            </a>
            <Link href="/book" className="inline-flex h-10 items-center gap-2 rounded-md border px-5 text-sm font-semibold hover:bg-muted">
              <CalendarDays className="h-4 w-4" /> Book a call
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Below, choose <strong className="text-foreground">Start planning</strong>, <strong className="text-foreground">Current client</strong>,{" "}
            <strong className="text-foreground">Investment Committee</strong> or <strong className="text-foreground">Careers</strong>. The form changes to match.
          </p>
        </Container>
      </section>

      <Container className="py-14 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ContactExperience topic={topic} role={role} positions={positions} />

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border bg-card p-5">
              <p className="font-semibold">Reach us</p>
              <ul className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <a href={CONTACT.phoneHref} className="text-muted-foreground hover:text-foreground">{CONTACT.phone}</a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium">Email</p>
                    <a href={`mailto:${CONTACT.email}`} className="break-words text-muted-foreground hover:text-foreground">{CONTACT.email}</a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Hours</p>
                    <p className="text-muted-foreground">{CONTACT.hours}</p>
                  </div>
                </li>
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {OFFICES.map((o, i) => (
                  <OfficeMapCard key={o.name} office={o} variant={i === 0 ? "east" : "west"} compact />
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 border-t pt-4">
                <span className="text-sm font-medium">Follow us</span>
                <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="ml-auto flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"><Facebook className="h-4 w-4" /></a>
                <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"><Linkedin className="h-4 w-4" /></a>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Briefcase className="h-4 w-4 text-gold" /> Want to join SIG?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Work that is more than just a job—it’s a calling. {openCount} positions available now.
              </p>
              <Link href="/join-our-team" className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:text-primary">
                See careers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <AskSiggyCard />
          </aside>
        </div>
      </Container>

      <PlannerGrid title="Book Your Appointment Online" />
    </>
  );
}
