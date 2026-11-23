import Link from "next/link";
import { ChevronRight, Link2Off } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { Button } from "@/components/ui/button";
import { changeState, loadBookingByManageToken } from "@/lib/booking/manage";
import { getPublishedTeamMember } from "@/lib/team/data";
import { CONTACT } from "@/lib/public-site/site-data";
import { ManageClient } from "./manage-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Manage your appointment",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await loadBookingByManageToken(token).catch(() => null);

  return (
    <div className="relative border-t bg-muted/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-gold/[0.07] to-transparent" aria-hidden />
      <Container className="relative max-w-5xl py-8 md:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/book" className="hover:text-foreground hover:underline">Schedule Online</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <Link href="/book/manage" className="hover:text-foreground hover:underline">Manage</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-foreground">{found ? found.booking.reference : "Appointment"}</span>
        </nav>
        {found ? (
          <ManageView token={token} found={found} />
        ) : (
          <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
            <Link2Off className="mx-auto h-8 w-8 text-gold" aria-hidden />
            <h1 className="mt-4 font-serif text-2xl">We couldn’t find that appointment</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The link may be incomplete or no longer active. We can email you a fresh link to your appointments.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild><Link href="/book/manage">Email me a link</Link></Button>
              <Button asChild variant="outline"><a href={CONTACT.phoneHref}>Call {CONTACT.phone}</a></Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

async function ManageView({ token, found }: { token: string; found: NonNullable<Awaited<ReturnType<typeof loadBookingByManageToken>>> }) {
  const { booking: b, type } = found;
  const planner = type.host_slug ? await getPublishedTeamMember(type.host_slug).catch(() => null) : null;
  const state = changeState(b, type);
  return (
    <ManageClient
      token={token}
      booking={{
        reference: b.reference, status: b.status, start_at: b.start_at, end_at: b.end_at, timezone: b.timezone,
        invitee_name: b.invitee_name, invitee_email: b.invitee_email, invitee_phone: b.invitee_phone,
        notify_email: Boolean(b.notify_email), notify_sms: Boolean(b.notify_sms),
        location_type: b.location_type, location_details: b.location_details,
        cancelled_by: b.cancelled_by ?? null, cancel_reason: b.cancel_reason, rescheduled_at: b.rescheduled_at ?? null,
      }}
      type={{
        name: type.name, slug: type.slug, description: type.description, duration_minutes: type.duration_minutes,
        office: type.office ?? planner?.office ?? null, min_notice_hours: type.min_notice_hours, max_advance_days: type.max_advance_days || 60,
        timezone: type.timezone || "America/Phoenix",
      }}
      planner={planner ? { name: planner.name, credentials: planner.credentials ?? null, title: planner.title ?? null, slug: planner.slug, photo: planner.photo || null } : { name: type.host_name || "Strategic Income Group", credentials: null, title: null, slug: null, photo: null }}
      initialState={state}
      officePhone={CONTACT.phone}
      officePhoneHref={CONTACT.phoneHref}
    />
  );
}
