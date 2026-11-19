import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Heart, Mail, MapPin, Mountain, Phone, Plane, Quote, Sparkles } from "lucide-react";
import { CtaBand, Container, PageHero } from "@/components/public-site/blocks";
import { CONTACT } from "@/lib/public-site/site-data";
import { TEAM, getTeamMember } from "@/lib/public-site/team";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TEAM.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props) {
  const m = getTeamMember((await params).slug);
  if (!m) return { title: "Team member not found" };
  return {
    title: m.slug === "michael-gauthier" ? "Meet our CEO — Michael Gauthier, CFP®" : `${m.name}${m.credentials ? `, ${m.credentials}` : ""}`,
    description: m.history[0]?.slice(0, 160),
  };
}

export default async function TeamMemberPage({ params }: Props) {
  const m = getTeamMember((await params).slug);
  if (!m) notFound();

  const facts = [
    { icon: Sparkles, label: "Who inspires me", text: m.inspires },
    { icon: Mountain, label: "Favorite Hobbies", text: m.hobbies },
    { icon: Plane, label: "Favorite destination", text: m.destination },
    { icon: Heart, label: "Why I love what I do", text: m.why },
  ].filter((f) => f.text);

  return (
    <>
      <PageHero
        eyebrow={m.title}
        title={m.name}
        breadcrumb={[{ label: "Our Team", href: "/team" }, { label: m.name }]}
        description={m.credentials ? <span className="font-medium text-brand-gold">{m.credentials}</span> : undefined}
        actions={
          m.booking
            ? [
                { label: "Schedule Appointment", href: m.booking },
                { label: "Contact SIG", href: "/contact" },
              ]
            : [{ label: "Contact SIG", href: "/contact" }]
        }
      />

      <Container className="py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.photo} alt={m.name} className="aspect-[4/5] w-full rounded-2xl border bg-gradient-to-b from-muted to-background object-cover object-top" />
            <div className="rounded-xl border bg-card p-5">
              <p className="font-serif text-xl">Contact {m.name.split(" ")[0].replace(/[“”"]/g, "")}</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a href={CONTACT.phoneHref} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Phone className="h-4 w-4 text-gold" /> {CONTACT.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 break-all text-muted-foreground hover:text-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-gold" /> {CONTACT.email}
                  </a>
                </li>
                {m.office ? (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-gold" /> {m.office}
                  </li>
                ) : null}
              </ul>
              {m.booking ? (
                <Link
                  href={m.booking}
                  className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <CalendarDays className="h-4 w-4" /> Schedule Appointment
                </Link>
              ) : null}
            </div>
          </aside>

          <div className="min-w-0">
            {m.quote ? (
              <figure className="mb-10 rounded-2xl border bg-muted/40 p-6 sm:p-8">
                <Quote className="h-6 w-6 text-gold" />
                <blockquote className="mt-3 font-serif text-2xl leading-snug">{m.quote}</blockquote>
                <figcaption className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Favorite Quote</figcaption>
              </figure>
            ) : null}

            <h2 className="font-serif text-3xl">Professional History</h2>
            <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-muted-foreground">
              {m.history.map((p) => (
                <p key={p.slice(0, 32)}>{p}</p>
              ))}
            </div>

            {facts.length ? (
              <div className="mt-12 grid gap-5 sm:grid-cols-2">
                {facts.map((f) => (
                  <div key={f.label} className="rounded-xl border bg-card p-6">
                    <f.icon className="h-5 w-5 text-gold" />
                    <h3 className="mt-3 font-serif text-xl">{f.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <Link href="/team" className="mt-12 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Our Team
            </Link>
          </div>
        </div>
      </Container>

      <CtaBand />
    </>
  );
}
