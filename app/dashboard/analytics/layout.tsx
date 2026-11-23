import type { ReactNode } from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";
import { requirePagePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata = { title: "Analytics — SIG Dashboard" };

// Access guard for /dashboard/analytics and every tab.
export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  await requirePagePermission(PERMISSIONS.VIEW_REPORTS, "/dashboard/analytics");
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Insights"
        title="Analytics"
        description="Where SIG's visitors come from — Google, AI assistants, social, email, texts, business cards and referrals — and which of them become leads, bookings and event sign-ups. First-party and cookieless."
      />
      <AnalyticsShell>{children}</AnalyticsShell>
    </div>
  );
}
