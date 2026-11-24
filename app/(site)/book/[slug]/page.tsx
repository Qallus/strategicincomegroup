import { notFound } from "next/navigation";
import { BookPageShell } from "@/components/booking/book-page-shell";
import { BookingFlow } from "@/components/booking/booking-flow";
import { loadBookingTypeBySlug } from "@/lib/booking/data";
import { loadBookingFlowData, toOption, toPlannerInfo } from "@/lib/booking/public-flow";
import { getPublishedTeamMember } from "@/lib/team/data";
import { CONTACT } from "@/lib/public-site/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = await loadBookingTypeBySlug(slug, { publicOnly: true }).catch(() => null);
  if (!type) return { title: "Booking not found" };
  return { title: `${type.name}${type.host_name ? ` with ${type.host_name}` : ""}`, description: type.description || undefined };
}

// A booking page deep link: the same flow as /book with this appointment chosen, opening on step 2.
export default async function BookTypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = await loadBookingTypeBySlug(slug, { publicOnly: true });
  if (!type) notFound();
  const member = type.host_slug ? await getPublishedTeamMember(type.host_slug) : null;
  const data = await loadBookingFlowData();
  // Keep link-only pages (and anything the listing skipped) reachable by their own URL.
  const options = data.options.some((o) => o.slug === type.slug)
    ? data.options
    : [...data.options, toOption(type, member ? toPlannerInfo(member) : null, false)];
  const hostName = member?.name ?? type.host_name ?? null;

  return (
    <BookPageShell
      title={hostName ? `Meet with ${hostName.split(",")[0]}` : type.name}
      subtitle={`${type.name} · ${type.duration_minutes} minutes. Pick a time that suits you, then add your details.`}
      breadcrumb={[
        { label: "Schedule Online", href: "/book" },
        ...(member ? [{ label: member.name, href: `/book?planner=${member.slug}` }] : []),
        { label: type.name },
      ]}
    >
      <BookingFlow options={options} planners={data.planners} officePhone={CONTACT.phone} officePhoneHref={CONTACT.phoneHref} />
    </BookPageShell>
  );
}
