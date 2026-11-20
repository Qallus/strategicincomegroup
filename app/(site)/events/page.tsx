import Link from "next/link";
import { ArrowRight, CalendarDays, Globe, Lock, MapPin, Users } from "lucide-react";
import { Container, PageHero } from "@/components/public-site/blocks";
import { loadPublicEvents } from "@/lib/booking/data";
import { ImpactBand } from "@/components/public-site/impact/impact-sections";
import { loadFmscImpact } from "@/lib/impact/fmsc";
import { EVENT_AUDIENCE_LABELS, EVENT_TYPE_LABELS, type EventItem } from "@/lib/booking/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Events",
  description: "Roundtables, workshops and community service events with the Strategic Income Group team.",
};

const day = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, day: "2-digit" });
const mon = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, month: "short" });
const when = (iso: string, tz: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function EventsIndexPage() {
  const [events, impact] = await Promise.all([loadPublicEvents().catch(() => [] as EventItem[]), loadFmscImpact()]);

  return (
    <>
      <PageHero
        eyebrow="RSVP Online"
        title="Strategic Income Group Events"
        accent="Events"
        breadcrumb={[{ label: "Events" }]}
        description="Roundtables, workshops and community service events with the Strategic Income Group team. Reserve your seat online."
      />
      {impact.recorded.length ? (
        <Container className="pt-10 md:pt-12">
          <ImpactBand impact={impact} />
        </Container>
      ) : null}
      <Container className="py-12 md:py-16">
        <h2 className="mb-6 font-serif text-3xl">Upcoming events</h2>
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-gold" />
            <p className="mt-4 font-serif text-2xl">No upcoming events right now</p>
            <p className="mt-2 text-sm text-muted-foreground">Please check back soon, or subscribe to our newsletter below to hear first.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {events.map((e) => {
              const online = e.location_type === "online";
              const Icon = online ? Globe : MapPin;
              const full = e.capacity != null && (e.registered_count ?? 0) >= e.capacity;
              return (
                <Link key={e.id} href={`/events/${e.slug}`} className="group flex gap-5 rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <div className="flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{mon(e.start_at, e.timezone)}</span>
                    <span className="font-serif text-3xl leading-none">{day(e.start_at, e.timezone)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {e.event_type ? <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gold">{EVENT_TYPE_LABELS[e.event_type]}</span> : null}
                      {e.audience && e.audience !== "public" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"><Lock className="h-3 w-3" /> {EVENT_AUDIENCE_LABELS[e.audience]}</span>
                      ) : null}
                      {full ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">Waitlist</span> : null}
                    </div>
                    <h2 className="mt-1.5 font-serif text-2xl leading-snug">{e.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{when(e.start_at, e.timezone)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {online ? "Online" : e.location_name || "In person"}</p>
                    {e.summary ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{e.summary}</p> : null}
                    <div className="mt-4 flex items-center justify-between text-sm">
                      {e.capacity != null ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4" /> {e.registered_count ?? 0} of {e.capacity}</span>
                      ) : <span />}
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        RSVP <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
