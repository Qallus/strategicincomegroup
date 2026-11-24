import { BookPageShell } from "@/components/booking/book-page-shell";
import { BookingFlow } from "@/components/booking/booking-flow";
import { loadBookingFlowData } from "@/lib/booking/public-flow";
import { CONTACT } from "@/lib/public-site/site-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Schedule Online",
  description: "Meet with a Certified Financial Planner or Wealth Advisor — schedule your appointment in just a couple of clicks.",
};

// /book is the booking flow itself: step 1 (planner + appointment) starts on the first screen.
// `?planner=`, `?type=` and `?step=` are read by the client flow, so deep links and Back work.
export default async function BookIndexPage() {
  const { options, planners } = await loadBookingFlowData();
  return (
    <BookPageShell
      title="Meet with a planner"
      subtitle="Choose an appointment, pick a time, and add your details — in person in Chandler or Peoria, by phone, or by video."
      breadcrumb={[{ label: "Schedule Online" }]}
    >
      <BookingFlow options={options} planners={planners} officePhone={CONTACT.phone} officePhoneHref={CONTACT.phoneHref} />
    </BookPageShell>
  );
}
