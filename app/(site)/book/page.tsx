import Link from "next/link";
import { ArrowRight, CalendarCheck2, CalendarDays, Clock, Lock, MapPin, Phone, Sparkles, Users, Video } from "lucide-react";
import { Container, PageHero } from "@/components/public-site/blocks";
import { loadPublicBookingTypes } from "@/lib/booking/data";
import { BOOKING_AUDIENCE_LABELS, type BookingType } from "@/lib/booking/types";
import { CONTACT } from "@/lib/public-site/site-data";
import type { TeamMember } from "@/lib/public-site/team";
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

const PROMISES = [
  { icon: Sparkles, title: "Free & no obligation", body: "Your first conversation is on us." },
  { icon: CalendarCheck2, title: "About a minute", body: "Pick a time, add your details, done." },
  { icon: MapPin, title: "Your choice of format", body: "In person, by phone, or by video." },
] as const;

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
        description="Meet with a Certified Financial Planner or Wealth Advisor — in person at our Chandler or Peoria office, by phone, or by video. Choose a planner and a time that suits you."
      >
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-3 rounded-xl border bg-background/70 p-3.5 backdrop-blur">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-gold">
                <p.icon className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{p.title}</span>
                <span className="block text-xs text-muted-foreground">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </PageHero>

      <Container className="py-12 md:py-16">
        {hosts.length > 1 ? (
          <nav aria-label="Filter by planner" className="-mx-4 mb-10 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-max gap-1 rounded-full border bg-muted/50 p-1">
              <FilterChip href="/book" active={!selected}>All planners</FilterChip>
              {hosts.map((h) => (
                <FilterChip key={h.slug} href={`/book?planner=${h.slug}`} active={selected?.slug === h.slug}>
                  {h.name}
                </FilterChip>
              ))}
            </div>
          </nav>
        ) : null}

        {visibleHosts.length === 0 && unassigned.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-gold" aria-hidden />
            <p className="mt-4 font-serif text-2xl">Online scheduling is being set up</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              In the meantime, call us at {CONTACT.phone} or send a message and we’ll find a time that works for you.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href={CONTACT.phoneHref} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">
                <Phone className="h-4 w-4" aria-hidden /> {CONTACT.phone}
              </a>
              <Link href="/contact" className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-semibold hover:bg-muted">
                Send a message
              </Link>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "grid gap-6",
            visibleHosts.length === 1
              ? "mx-auto max-w-2xl"
              : visibleHosts.length === 2 || visibleHosts.length === 4
                ? "md:grid-cols-2"
                : "md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {visibleHosts.map((h, i) => (
            <PlannerCard key={h.slug} planner={h} types={types.filter((t) => t.host_slug === h.slug)} index={i} />
          ))}
        </div>

        {!selected && unassigned.length ? (
          <section className="mt-14" aria-labelledby="other-ways">
            <h2 id="other-ways" className="font-serif text-2xl">Other ways to meet</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {unassigned.map((t) => (
                <li key={t.id} className="rounded-2xl border bg-card">
                  <TypeRow t={t} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl border bg-muted/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm text-muted-foreground">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
            <span>
              <span className="block font-semibold text-foreground">Not sure who to meet with?</span>
              Tell us a little about what you need and we’ll match you with the right planner.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/contact" className="inline-flex h-10 items-center rounded-md border bg-background px-4 text-sm font-semibold hover:bg-muted">
              Send a message
            </Link>
            <a href={CONTACT.phoneHref} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Phone className="h-4 w-4" aria-hidden /> {CONTACT.phone}
            </a>
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Your details go only to your planner and the Strategic Income Group team.
        </p>
      </Container>
    </>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function PlannerCard({ planner: h, types, index }: { planner: TeamMember; types: BookingType[]; index: number }) {
  return (
    <section
      aria-labelledby={`planner-${h.slug}`}
      className="sig-book-in group/card flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="relative flex items-center gap-4 border-b p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/60 to-transparent" aria-hidden />
        {h.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={h.photo}
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl border bg-gradient-to-b from-muted to-background object-cover object-top"
          />
        ) : (
          <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border bg-muted font-serif text-3xl text-muted-foreground">
            {h.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={`planner-${h.slug}`} className="font-serif text-2xl leading-tight">{h.name}</h2>
          {h.credentials ? <p className="text-sm font-medium text-gold">{h.credentials}</p> : null}
          {h.title ? <p className="mt-0.5 text-sm text-muted-foreground">{h.title}</p> : null}
          {h.office ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden /> {h.office}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="flex-1 divide-y">
        {types.map((t) => (
          <li key={t.id}>
            <TypeRow t={t} />
          </li>
        ))}
      </ul>
      <div className="border-t bg-muted/30 px-5 py-3 text-sm">
        <Link href={`/team/${h.slug}`} className="font-medium text-muted-foreground hover:text-foreground hover:underline">
          About {h.name.split(" ")[0]} →
        </Link>
      </div>
    </section>
  );
}

function TypeRow({ t }: { t: BookingType }) {
  const Icon = ICONS[t.location_type] ?? Clock;
  return (
    <Link
      href={`/book/${t.slug}`}
      className="group flex items-center gap-4 p-5 transition hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className="h-10 w-1 shrink-0 rounded-full"
        style={{ background: t.color || "hsl(var(--primary))" }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{t.name}</span>
          {t.audience && t.audience !== "everyone" ? (
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {BOOKING_AUDIENCE_LABELS[t.audience]}
            </span>
          ) : null}
        </span>
        {t.description ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{t.description}</span> : null}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden /> {t.duration_minutes} min</span>
          <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" aria-hidden /> {LOCATION_LABEL[t.location_type]}</span>
        </span>
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        <span className="sr-only">Book {t.name}</span>
      </span>
    </Link>
  );
}
