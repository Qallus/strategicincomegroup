import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, Globe, Lock, MapPin, Navigation, TimerReset, Users } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { loadEventBySlug } from "@/lib/booking/data";
import { EVENT_AUDIENCE_LABELS, EVENT_TYPE_LABELS } from "@/lib/booking/types";
import { getPublishedTeam } from "@/lib/team/data";
import { KidsFedGrid } from "@/components/public-site/impact/impact-charts";
import { ImpactCounters, MilestoneTrail } from "@/components/public-site/impact/impact-sections";
import { loadFmscImpact } from "@/lib/impact/fmsc";
import { kidsFedForAYear } from "@/lib/booking/types";
import { EventRegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await loadEventBySlug(slug, { publicOnly: true }).catch(() => null);
  if (!event) return { title: "Event not found" };
  return { title: event.title, description: event.summary || undefined };
}

const fmtDate = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const fmtTime = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await loadEventBySlug(slug, { publicOnly: true });
  if (!event) notFound();
  const team = event.speakers?.some((s) => s.team_slug) ? await getPublishedTeam() : [];
  const getTeamMember = (teamSlug: string) => team.find((m) => m.slug === teamSlug) ?? null;

  const tz = event.timezone;
  const online = event.location_type === "online";
  const Icon = online ? Globe : MapPin;
  const full = event.capacity != null && (event.registered_count ?? 0) >= event.capacity;
  const closed = event.registration_closes_at ? new Date(event.registration_closes_at) < new Date() : false;
  const past = new Date(event.end_at ?? event.start_at) < new Date() || event.status === "completed";
  const spotsLeft = event.capacity != null ? Math.max(0, event.capacity - (event.registered_count ?? 0)) : null;
  const maxParty = event.allow_guests === false ? 1 : event.max_party_size ?? 4;
  // FMSC packings show SIGCares results to date (event.impact_program, or the known slug before the migration runs).
  const isFmsc = event.impact_program === "fmsc" || event.slug.startsWith("fmsc-");
  const impact = isFmsc ? await loadFmscImpact() : null;
  // FMSC packings fall back to the SIGCares packing photo until one is set in Dashboard → Events.
  const cover = event.cover_image_url || (isFmsc ? "/events/fmsc-food-packing.webp" : null);
  const directions =
    event.directions_url || (event.location_address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location_address)}` : null);

  return (
    <>
      <section className="sig-on-navy relative overflow-hidden bg-[hsl(225_95%_15%)] text-white dark:bg-[hsl(228_60%_5%)]">
        <div className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <Container className="relative py-12 md:py-16">
          <Link href="/events" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All events
          </Link>
          <div className="mt-6 flex flex-wrap gap-2">
            {event.event_type ? <span className="rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold text-[hsl(225_80%_10%)]">{EVENT_TYPE_LABELS[event.event_type]}</span> : null}
            {event.audience && event.audience !== "public" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1 text-xs"><Lock className="h-3 w-3" /> {EVENT_AUDIENCE_LABELS[event.audience]}</span>
            ) : null}
          </div>
          {event.series ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">{event.series}</p> : null}
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{event.title}</h1>
          {event.summary ? <p className="mt-4 max-w-2xl text-lg text-white/75">{event.summary}</p> : null}
          <dl className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
              <dt className="flex items-center gap-1.5 text-xs text-white/60"><CalendarDays className="h-3.5 w-3.5" /> Date</dt>
              <dd className="mt-1 font-medium">{fmtDate(event.start_at, tz)}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
              <dt className="flex items-center gap-1.5 text-xs text-white/60"><Clock className="h-3.5 w-3.5" /> Time</dt>
              <dd className="mt-1 font-medium">{fmtTime(event.start_at, tz)}{event.end_at ? ` – ${fmtTime(event.end_at, tz)}` : ""}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
              <dt className="flex items-center gap-1.5 text-xs text-white/60"><Icon className="h-3.5 w-3.5" /> Location</dt>
              <dd className="mt-1 font-medium">{online ? "Online" : event.location_name || "In person"}</dd>
            </div>
          </dl>
        </Container>
      </section>

      <Container className="py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-10">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={isFmsc && !event.cover_image_url ? "Volunteers in hairnets smiling as they pack meals at Feed My Starving Children" : ""}
                className="aspect-[16/9] w-full rounded-2xl border object-cover"
              />
            ) : null}
            {event.description ? (
              <div className="sig-prose max-w-[68ch]">
                {event.description.split(/\n{2,}/).map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            ) : null}

            {event.speakers?.length ? (
              <section>
                <h2 className="font-serif text-2xl">{event.speakers.length > 1 ? "Speakers" : "Your host"}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {event.speakers.map((s) => {
                    const member = s.team_slug ? getTeamMember(s.team_slug) : null;
                    const photo = s.photo_url || member?.photo;
                    return (
                      <div key={s.name} className="flex gap-4 rounded-xl border bg-card p-4">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-full border object-cover object-top" />
                        ) : (
                          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted font-serif text-xl">{s.name.charAt(0)}</span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium">{member ? <Link href={`/team/${member.slug}`} className="hover:underline">{s.name}</Link> : s.name}</p>
                          {s.title ? <p className="text-sm text-muted-foreground">{s.title}</p> : null}
                          {s.bio ? <p className="mt-2 text-sm text-muted-foreground">{s.bio}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {!online && (event.location_address || directions) ? (
              <section className="rounded-2xl border bg-card p-6">
                <h2 className="font-serif text-2xl">Directions</h2>
                <p className="mt-2 flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span>
                    <span className="font-medium text-foreground">{event.location_name}</span>
                    {event.location_address ? <><br />{event.location_address}</> : null}
                  </span>
                </p>
                {event.arrival_note ? <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><TimerReset className="h-4 w-4 text-gold" /> {event.arrival_note}</p> : null}
                {directions ? (
                  <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted">
                    <Navigation className="h-4 w-4" /> Driving Directions
                  </a>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border bg-card p-6">
              <p className="font-serif text-2xl">{past ? "This event has ended" : "Sign-Up Today"}</p>
              {event.capacity != null && !past ? (
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4" /> {event.registered_count ?? 0} of {event.capacity} total</span>
                    <span className="font-medium">{full ? (event.waitlist_enabled === false ? "Full" : "Waitlist open") : `${spotsLeft} left`}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((event.registered_count ?? 0) / event.capacity) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Space is limited.</p>
                </div>
              ) : null}
              {event.registration_closes_at && !past ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Deadline: <span className="font-medium text-foreground">{fmtDate(event.registration_closes_at, tz)}</span>
                </p>
              ) : null}
              <div className="mt-5 border-t pt-5">
                {past ? (
                  <p className="text-sm text-muted-foreground">
                    Thank you to everyone who joined us. <Link href="/events" className="font-medium text-primary hover:underline">See upcoming events →</Link>
                  </p>
                ) : full && event.waitlist_enabled === false ? (
                  <p className="text-sm text-muted-foreground">
                    This event is full. <Link href="/contact" className="font-medium text-primary hover:underline">Contact us</Link> to ask about openings.
                  </p>
                ) : event.registration_required ? (
                  <EventRegisterForm
                    slug={event.slug}
                    customFields={event.custom_fields ?? []}
                    full={full}
                    closed={closed}
                    spotsLeft={spotsLeft}
                    maxPartySize={maxParty}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No registration needed — we look forward to seeing you there.</p>
                )}
              </div>
              {online && event.meeting_id && !past ? <p className="mt-4 text-xs text-muted-foreground">Meeting ID: <span className="font-mono">{event.meeting_id}</span></p> : null}
            </div>
          </aside>
        </div>

        {impact && impact.recorded.length ? (
          <section className="mt-14 rounded-3xl border bg-muted/30 p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">SIGCares results to date</p>
                <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Together, we’ve fed {impact.totals.kids.toLocaleString("en-US")} kids for a year.</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {event.impact_meals
                    ? `This packing: ${event.impact_meals.toLocaleString("en-US")} meals · ${kidsFedForAYear(event.impact_meals)} kids fed for a year`
                    : "Your RSVP helps write the next chapter."}
                </p>
              </div>
              <Link href="/sigcares" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">See the full SIGCares story →</Link>
            </div>
            <div className="mt-8">
              <ImpactCounters impact={impact} />
            </div>
            <div className="mt-8">
              <KidsFedGrid recorded={impact.recorded} />
            </div>
            <div className="mt-10">
              <MilestoneTrail impact={impact} />
            </div>
          </section>
        ) : null}
      </Container>
    </>
  );
}
