import { Suspense } from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { SmsTabs } from "@/components/sms/sms-tabs";
import { SmsInbox } from "@/components/sms/sms-inbox";
import { SmsCampaigns } from "@/components/sms/sms-campaigns";

// /dashboard/sms?campaign=new opens the bulk campaign composer (linked from the dashboard
// SMS widget); ?campaign=<id> opens that campaign.
export default function SmsInboxPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="SMS" description="Inbound and outbound text message conversations, and bulk campaigns." />
      <SmsTabs />
      <Suspense fallback={null}>
        <SmsCampaigns variant="strip" />
      </Suspense>
      <SmsInbox />
    </div>
  );
}
