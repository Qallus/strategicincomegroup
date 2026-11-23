import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { loadBookingTypeBySlug, loadPublicBookingTypes } from "@/lib/booking/data";
import type { BookingType } from "@/lib/booking/types";
import { getPublishedTeamMember } from "@/lib/team/data";
import { CONTACT } from "@/lib/public-site/site-data";
import { BookWidget, type MeetingOption } from "./book-widget";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = await loadBookingTypeBySlug(slug, { publicOnly: true }).catch(() => null);
  if (!type) return { title: "Booking not found" };
  return { title: `${type.name}${type.host_name ? ` with ${type.host_name}` : ""}`, description: type.description || undefined };
}

function toOption(t: BookingType, plannerOffice?: string | null): MeetingOption {
  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    durationMinutes: t.duration_minutes,
    locationType: t.location_type,
    locationDetails: t.location_details,
    office: t.office ?? plannerOffice ?? null,
    audience: t.audience ?? "everyone",
    color: t.color,
    timezone: t.timezone || "America/Phoenix",
    questions: t.questions ?? [],
    maxAdvanceDays: t.max_advance_days || 60,
  };
}

export default async function BookTypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = await loadBookingTypeBySlug(slug, { publicOnly: true });
  if (!type) notFound();
  const planner = type.host_slug ? await getPublishedTeamMember(type.host_slug) : null;
  const siblings = planner
    ? (await loadPublicBookingTypes().catch(() => [] as BookingType[])).filter((t) => t.host_slug === planner.slug)
    : [];
  const options = (siblings.length ? siblings : [type]).map((t) => toOption(t, planner?.office));
  const hostName = planner?.name ?? type.host_name ?? null;

  return (
    <div className="relative border-t bg-muted/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-gold/[0.07] to-transparent" aria-hidden />
      <Container className="relative max-w-6xl py-8 md:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <Link href="/book" className="hover:text-foreground hover:underline">Schedule Online</Link>
          {planner ? (
            <>
              <ChevronRight className="h-3 w-3" aria-hidden />
              <Link href={`/book?planner=${planner.slug}`} className="hover:text-foreground hover:underline">{planner.name}</Link>
            </>
          ) : null}
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-foreground">{type.name}</span>
        </nav>

        <header className="mb-8 flex items-center gap-4">
          {planner?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={planner.photo} alt="" className="h-16 w-16 shrink-0 rounded-2xl border bg-gradient-to-b from-muted to-background object-cover object-top sm:h-20 sm:w-20" />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Schedule online</p>
            <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{hostName ? `Meet with ${hostName.split(",")[0]}` : type.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {planner?.credentials ? <span className="font-medium text-gold">{planner.credentials}</span> : null}
              {planner?.title ? <span>{planner.title}</span> : null}
              {planner?.office ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden /> {planner.office}</span> : null}
            </p>
          </div>
        </header>

        <BookWidget
          key={type.slug}
          initialSlug={type.slug}
          options={options}
          planner={planner ? { name: planner.name, credentials: planner.credentials ?? null, title: planner.title ?? null, slug: planner.slug, photo: planner.photo || null, office: planner.office ?? null } : null}
          hostName={hostName}
          officePhone={CONTACT.phone}
          officePhoneHref={CONTACT.phoneHref}
        />
      </Container>
    </div>
  );
}
