import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, MapPin, Phone, Users, Video } from "lucide-react";
import { Container, PageHero } from "@/components/public-site/blocks";
import { loadPublicBookingTypes } from "@/lib/booking/data";
import { BOOKING_AUDIENCE_LABELS, type BookingType } from "@/lib/booking/types";
import { CONTACT } from "@/lib/public-site/site-data";
import { getPublishedTeam } from "@/lib/team/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Schedule Online",
  description: "Meet with a Certified Financial Planner or Wealth Advisor — schedule your appointment in just a couple of clicks.",
};

const ICONS = { video: Video, phone: Phone, in_person: MapPin, custom: Clock } as const;
const LOCATION_LABEL = { video: "Video call", phone: "Phone call", in_person: "In person", custom: "Details to follow" } as const;

type Props = { searchParams: Promise<{ planner?: string }> };

export default async function BookIndexPage({ searchParams }: Props) {
  const { planner } = await searchParams;
  const [types, TEAM] = await Promise.all([loadPublicBookingTypes().catch(() => [] as BookingType[]), getPublishedTeam()]);
  const getTeamMember = (slug: string) => TEAM.find((m) => m.slug === slug) ?? null;

  // Group booking pages by planner, in team order; pages without a planner go last.
  const hosts = TEAM.filter((m) => types.some((t) => t.host_slug === m.slug));
  // `host_slug === null` (not undefined) means the SIG booking migration has run, so these are
  // real SIG pages without a planner — before it runs, the MJG fork's seed types stay hidden.
  const unassigned = types.filter((t) => t.host_slug === null || (t.host_slug && !getTeamMember(t.host_slug)));
  const selected = planner ? getTeamMember(planner) : null;
  const visibleHosts = selected ? hosts.filter((h) => h.slug === selected.slug) : hosts;

  return (
    <>
      <PageHero
        tone="plain"
        eyebrow="Schedule Online"
        title={selected ? `Book time with ${selected.name}` : "Meet with a planner"}
        accent={selected ? selected.name : "planner"}
        breadcrumb={selected ? [{ label: "Schedule Online", href: "/book" }, { label: selected.name }] : [{ label: "Schedule Online" }]}
        description="Meet with a Certified Financial Planner or Wealth Advisor—schedule your appointment in just a couple of clicks. In person at our Chandler or Peoria office, by phone, or by video."
      />

      <Container className="py-12 md:py-16">
        {hosts.length > 1 ? (
          <nav aria-label="Choose a planner" className="mb-10 flex flex-wrap gap-2">
            <Link href="/book" className={cn("rounded-full border px-4 py-1.5 text-sm transition", !selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              All planners
            </Link>
            {hosts.map((h) => (
              <Link
                key={h.slug}
                href={`/book?planner=${h.slug}`}
                className={cn("rounded-full border px-4 py-1.5 text-sm transition", selected?.slug === h.slug ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {h.name}
              </Link>
            ))}
          </nav>
        ) : null}

        {visibleHosts.length === 0 && unassigned.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-gold" />
            <p className="mt-4 font-serif text-2xl">Online scheduling is being set up</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              In the meantime, call us at {CONTACT.phone} or send a message and we’ll find a time that works for you.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href={CONTACT.phoneHref} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">
                <Phone className="h-4 w-4" /> {CONTACT.phone}
              </a>
              <Link href="/contact" className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-semibold hover:bg-muted">
                Send a message
              </Link>
            </div>
          </div>
        ) : null}

        <div className="space-y-8">
          {visibleHosts.map((h) => {
            const mine = types.filter((t) => t.host_slug === h.slug);
            return (
              <section key={h.slug} className="grid gap-6 rounded-2xl border bg-card p-5 sm:p-6 lg:grid-cols-[260px_1fr]">
                <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                  {h.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.photo} alt={h.name} className="h-24 w-24 shrink-0 rounded-xl border bg-gradient-to-b from-muted to-background object-cover object-top lg:h-auto lg:w-full lg:aspect-[4/3]" />
                  ) : (
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border bg-muted font-serif text-4xl text-muted-foreground lg:h-auto lg:w-full lg:aspect-[4/3]">{h.name.charAt(0)}</span>
                  )}
                  <div>
                    <h2 className="font-serif text-2xl leading-tight">{h.name}</h2>
                    {h.credentials ? <p className="text-sm text-gold">{h.credentials}</p> : null}
                    <p className="mt-1 text-sm text-muted-foreground">{h.title}</p>
                    {h.office ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {h.office}
                      </p>
                    ) : null}
                    <Link href={`/team/${h.slug}`} className="mt-3 block text-sm font-medium text-primary hover:underline">
                      View profile →
                    </Link>
                  </div>
                </div>
                <div className="grid content-start gap-3 sm:grid-cols-2">
                  {mine.map((t) => (
                    <TypeCard key={t.id} t={t} />
                  ))}
                </div>
              </section>
            );
          })}

          {!selected && unassigned.length ? (
            <section>
              <h2 className="font-serif text-2xl">Other ways to meet</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unassigned.map((t) => (
                  <TypeCard key={t.id} t={t} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 text-gold" /> Not sure who to meet with?{" "}
          <Link href="/contact" className="font-medium text-primary hover:underline">Tell us what you need</Link> and we’ll match you with the right planner.
        </p>
      </Container>
    </>
  );
}

function TypeCard({ t }: { t: BookingType }) {
  const Icon = ICONS[t.location_type] ?? Clock;
  return (
    <Link href={`/book/${t.slug}`} className="group flex flex-col rounded-xl border bg-background p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">{t.name}</span>
        {t.audience && t.audience !== "everyone" ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{BOOKING_AUDIENCE_LABELS[t.audience]}</span>
        ) : null}
      </div>
      {t.description ? <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">{t.description}</p> : <span className="flex-1" />}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.duration_minutes} min</span>
          <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" /> {LOCATION_LABEL[t.location_type]}</span>
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-primary">
          Book <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
