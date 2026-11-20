import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { loadBookingTypeBySlug, loadPublicBookingTypes } from "@/lib/booking/data";
import { getPublishedTeamMember } from "@/lib/team/data";
import { CONTACT } from "@/lib/public-site/site-data";
import { BookWidget } from "./book-widget";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = await loadBookingTypeBySlug(slug, { publicOnly: true }).catch(() => null);
  if (!type) return { title: "Booking not found" };
  return { title: `${type.name}${type.host_name ? ` with ${type.host_name}` : ""}`, description: type.description || undefined };
}

export default async function BookTypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = await loadBookingTypeBySlug(slug, { publicOnly: true });
  if (!type) notFound();
  const planner = type.host_slug ? await getPublishedTeamMember(type.host_slug) : null;
  const siblings = planner
    ? (await loadPublicBookingTypes().catch(() => [])).filter((t) => t.host_slug === planner.slug)
    : [];
  const meetingOptions = (siblings.length ? siblings : [type]).map((t) => ({
    slug: t.slug, name: t.name, durationMinutes: t.duration_minutes, locationType: t.location_type, audience: t.audience ?? "everyone",
  }));

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
        <BookWidget
          slug={type.slug}
          name={type.name}
          description={type.description}
          durationMinutes={type.duration_minutes}
          locationType={type.location_type}
          locationDetails={type.location_details}
          hostName={planner?.name ?? type.host_name}
          hostCredentials={planner?.credentials ?? null}
          hostTitle={planner?.title ?? null}
          hostSlug={planner?.slug ?? null}
          hostPhoto={planner?.photo || null}
          office={type.office ?? planner?.office ?? null}
          color={type.color}
          timezone={type.timezone}
          questions={type.questions ?? []}
          maxAdvanceDays={type.max_advance_days || 60}
          meetingOptions={meetingOptions}
          officePhone={CONTACT.phone}
          officePhoneHref={CONTACT.phoneHref}
        />
      </Container>
    </div>
  );
}
