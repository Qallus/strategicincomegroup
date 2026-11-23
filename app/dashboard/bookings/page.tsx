import { SectionHeader } from "@/components/dashboard/section-header";
import { getCurrentProfile } from "@/lib/auth/server";
import { isBookingAdminRole } from "@/lib/booking/access";
import { loadBookingManagerData, loadPlannerLinks, loadStaffOptions, type PlannerLink } from "@/lib/booking/data";
import { BookingsClient } from "./bookings-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings & Events — SIG Dashboard" };

export default async function BookingsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = isBookingAdminRole(profile?.role);
  // Planners (non-admin staff) only see the booking pages and events they host.
  const [data, staff, plannerLinks] = await Promise.all([
    loadBookingManagerData(isAdmin ? {} : { hostId: profile?.id ?? "__none__" }),
    loadStaffOptions(),
    isAdmin ? loadPlannerLinks().catch(() => [] as PlannerLink[]) : Promise.resolve([] as PlannerLink[]),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace"
        title="Bookings & Events"
        description="Planner booking pages, appointments, and SIG events — the native scheduling behind /book and /events on the public site."
      />
      <BookingsClient initialData={data} staffOptions={staff} isAdmin={isAdmin} meId={profile?.id ?? null} plannerLinks={plannerLinks} />
    </div>
  );
}
