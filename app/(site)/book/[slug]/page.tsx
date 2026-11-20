import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { loadBookingTypeBySlug, loadPublicBookingTypes } from "@/lib/booking/data";
import { getPublishedTeamMember } from "@/lib/team/data";
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
    ? (await loadPublicBookingTypes().catch(() => [])).filter((t) => t.host_slug === planner.slug && t.slug !== type.slug)
    : [];

  return (
    <div className="border-t bg-muted/30">
      <Container className="max-w-5xl py-10 md:py-14">
        <Link
          href={planner ? `/book?planner=${planner.slug}` : "/book"}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {planner ? `All times with ${planner.name}` : "Schedule Online"}
        </Link>
        <BookWidget
          slug={type.slug}
          name={type.name}
          description={type.description}
          durationMinutes={type.duration_minutes}
          locationType={type.location_type}
          locationDetails={type.location_details}
          hostName={type.host_name}
          hostPhoto={planner?.photo ?? null}
          office={type.office ?? null}
          color={type.color}
          timezone={type.timezone}
          questions={type.questions ?? []}
        />
        {siblings.length ? (
          <div className="mt-8">
            <p className="text-sm font-medium">Other ways to meet with {planner?.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <Link key={s.id} href={`/book/${s.slug}`} className="rounded-full border bg-background px-4 py-1.5 text-sm hover:border-primary/40 hover:bg-muted">
                  {s.name} · {s.duration_minutes} min
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </Container>
    </div>
  );
}
