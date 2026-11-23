import { notFound } from "next/navigation";
import { JsonLd } from "@/components/public-site/json-ld";
import { personJsonLd } from "@/lib/public-site/seo";
import Link from "next/link";
import {
  ArrowLeft, Briefcase, CalendarDays, Clock, Heart, Linkedin, Mail, MapPin, Mountain, Phone, Plane, Quote, ShoppingBag, Sparkles,
} from "lucide-react";
import { CtaBand, Container, PageHero } from "@/components/public-site/blocks";
import { CONTACT } from "@/lib/public-site/site-data";
import { getPublishedTeam, getPublishedTeamMember } from "@/lib/team/data";
import { formatTime, formatWorkDays } from "@/lib/team/fields";

type Props = { params: Promise<{ slug: string }> };

// Profiles are edited in the dashboard (My Profile); saves revalidate these pages
// immediately, and this is the safety net.
export const revalidate = 300;

export async function generateStaticParams() {
  return (await getPublishedTeam()).map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props) {
  const m = await getPublishedTeamMember((await params).slug);
  if (!m) return { title: "Team member not found" };
  return {
    title: m.slug === "michael-gauthier" ? "Meet our CEO — Michael Gauthier, CFP®" : `${m.name}${m.credentials ? `, ${m.credentials}` : ""}`,
    description: (m.history[0] ?? `${m.name} — ${m.title} at Strategic Income Group.`).slice(0, 160),
    openGraph: m.photo ? { images: [m.photo] } : undefined,
  };
}

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits.startsWith("+") ? digits : `+1${digits.replace(/^1/, "")}`}`;
}

function sinceLabel(date?: string) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function TeamMemberPage({ params }: Props) {
  const m = await getPublishedTeamMember((await params).slug);
  if (!m) notFound();

  const firstName = (m.firstName ?? m.name.split(" ")[0]).replace(/[“”"]/g, "");
  const phone = m.phone || CONTACT.phone;
  const email = m.email || CONTACT.email;
  const days = formatWorkDays(m.workDays);
  const hours = m.startTime && m.closeTime ? `${formatTime(m.startTime)} – ${formatTime(m.closeTime)}` : m.startTime ? `From ${formatTime(m.startTime)}` : m.closeTime ? `Until ${formatTime(m.closeTime)}` : "";
  const since = sinceLabel(m.employmentDate);
  const gallery = m.gallery ?? [];

  const facts = [
    { icon: Sparkles, label: "Who inspires me", text: m.inspires },
    { icon: Mountain, label: "Favorite Hobbies", text: m.hobbies },
    { icon: Plane, label: "Favorite destination", text: m.destination },
    { icon: ShoppingBag, label: "Best purchase under $100", text: m.bestPurchase },
    { icon: Heart, label: "Why I love what I do", text: m.why },
  ].filter((f) => f.text);

  return (
    <>
      <JsonLd data={personJsonLd(m)} />
      <PageHero
        eyebrow={m.title || "Strategic Income Group"}
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
            {m.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo} alt={m.name} className="aspect-[4/5] w-full rounded-2xl border bg-gradient-to-b from-muted to-background object-cover object-top" />
            ) : (
              <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl border bg-gradient-to-b from-muted to-background font-serif text-7xl text-muted-foreground/60">
                {m.name.charAt(0)}
              </div>
            )}
            <div className="rounded-xl border bg-card p-5">
              <p className="font-serif text-xl">Contact {firstName}</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a href={m.phone ? telHref(m.phone) : CONTACT.phoneHref} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Phone className="h-4 w-4 shrink-0 text-gold" /> {phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${email}`} className="flex items-center gap-2 break-all text-muted-foreground hover:text-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-gold" /> {email}
                  </a>
                </li>
                {m.linkedin ? (
                  <li>
                    <a href={m.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Linkedin className="h-4 w-4 shrink-0 text-gold" /> LinkedIn profile
                    </a>
                  </li>
                ) : null}
                {m.office ? (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-gold" /> {m.office}
                  </li>
                ) : null}
              </ul>

              {days || hours ? (
                <div className="mt-5 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Work schedule</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {days ? <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-gold" /> {days}</li> : null}
                    {hours ? <li className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-gold" /> {hours}</li> : null}
                  </ul>
                </div>
              ) : null}

              {since ? (
                <p className="mt-4 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4 shrink-0 text-gold" /> With SIG since {since}
                </p>
              ) : null}

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

            {m.history.length ? (
              <>
                <h2 className="font-serif text-3xl">Professional History</h2>
                <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-muted-foreground">
                  {m.history.map((p, i) => (
                    <p key={`${i}-${p.slice(0, 24)}`}>{p}</p>
                  ))}
                </div>
              </>
            ) : null}

            {facts.length ? (
              <div className="mt-12 grid gap-5 sm:grid-cols-2">
                {facts.map((f) => (
                  <div key={f.label} className="rounded-xl border bg-card p-6">
                    <f.icon className="h-5 w-5 text-gold" />
                    <h3 className="mt-3 font-serif text-xl">{f.label}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {gallery.length ? (
              <section className="mt-12">
                <h2 className="font-serif text-3xl">Gallery</h2>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                  {gallery.map((src, i) => (
                    <a
                      key={src}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block aspect-square overflow-hidden rounded-xl border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`${m.name} — photo ${i + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    </a>
                  ))}
                </div>
              </section>
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
