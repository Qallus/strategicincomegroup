import { CalendarClock, FileText, MailCheck, MessageSquare, Phone, UserPlus, UsersRound } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { getSigOverview } from "@/lib/dashboard/overview";

export const dynamic = "force-dynamic";

// Phase 1 placeholder: firm-level counts. Detailed CRM, booking, and campaign
// reports arrive with their modules in later phases.
export default async function ReportsPage() {
  const o = await getSigOverview();
  const cards = [
    { label: "Contacts", value: String(o.contacts), detail: "Active CRM contacts", icon: UsersRound },
    { label: "Leads", value: String(o.leads), detail: "Open leads", icon: UserPlus },
    { label: "Appointments this month", value: String(o.bookingsThisMonth), detail: `${o.upcomingBookings} upcoming`, icon: CalendarClock },
    { label: "Calls this month", value: String(o.callsThisMonth), detail: "Twilio voice", icon: Phone },
    { label: "SMS conversations", value: String(o.smsConversations), detail: "Twilio SMS", icon: MessageSquare },
    { label: "Emails this month", value: String(o.emailsThisMonth), detail: "Logged sends", icon: MailCheck },
    { label: "Published posts", value: String(o.publishedPosts), detail: "Blog", icon: FileText },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader title="Reports" description="Firm-wide activity for Strategic Income Group." />
      <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => <MetricCard key={c.label} {...c} />)}
      </StatCardRow>
      {o.error ? <p className="text-xs text-muted-foreground">Some counts are unavailable: {o.error}</p> : null}
    </div>
  );
}
