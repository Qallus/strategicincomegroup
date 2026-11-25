import { Suspense } from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { SmsTabs } from "@/components/sms/sms-tabs";
import { SmsCampaigns } from "@/components/sms/sms-campaigns";

// Bulk SMS campaigns. Access: ../layout.tsx (manage_settings = Super Admin / Admin); the API
// routes check again.
export default function SmsCampaignsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="SMS" description="Bulk campaigns to contacts, tags and segments, with per-recipient delivery status." />
      <SmsTabs />
      <Suspense fallback={null}>
        <SmsCampaigns variant="full" />
      </Suspense>
    </div>
  );
}
