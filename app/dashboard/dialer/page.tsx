import { SectionHeader } from "@/components/dashboard/section-header";
import { DialerDashboard } from "@/components/dialer/dialer-dashboard";
import { getCurrentProfile } from "@/lib/auth/server";
import { ROLES } from "@/lib/rbac/roles";

export const dynamic = "force-dynamic";

export default async function DialerPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === ROLES.SUPER_ADMIN || profile?.role === ROLES.ADMIN;
  return (
    <div className="space-y-6">
      <SectionHeader title="Dialer" description="Softphone, call logs, talk time, recordings, transcripts and live call monitoring." />
      <DialerDashboard isAdmin={isAdmin} />
    </div>
  );
}
