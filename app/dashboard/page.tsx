import Link from "next/link";
import { CalendarClock, MailCheck, MessageSquare, MessageSquareText, MessagesSquare, CornerUpLeft, Phone, UserPlus, UsersRound } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SectionHeader } from "@/components/dashboard/section-header";
import { getInvitationCounts, getRecentInvitations } from "@/lib/user-management/repository";
import { InvitationStats } from "@/components/dashboard/invitation-stats";
import { getCurrentProfile } from "@/lib/auth/server";
import { getMyOpenTasks } from "@/lib/project-manager/my-tasks";
import { getDmStats } from "@/lib/direct-messages/data";
import { getSigOverview } from "@/lib/dashboard/overview";
import { MyTasksCard } from "@/components/dashboard/my-tasks-card";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { ROLES } from "@/lib/rbac/roles";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === ROLES.SUPER_ADMIN || profile?.role === ROLES.ADMIN;
  const [overview, invStats, recentInvitations] = await Promise.all([
    getSigOverview(),
    isAdmin ? getInvitationCounts() : Promise.resolve(null),
    isAdmin ? getRecentInvitations() : Promise.resolve([]),
  ]);
  const myTasks = profile
    ? await getMyOpenTasks({ id: profile.id, role: profile.role, email: profile.email })
    : [];
  const myName = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() : "";
  const dmStats = profile ? await getDmStats(profile.id) : { unread: 0, activeConversations: 0, awaitingReply: 0 };
  const dmCards = [
    { label: "Unread messages", value: dmStats.unread, detail: dmStats.unread ? "New for you" : "All caught up", icon: MessageSquareText },
    { label: "Active conversations", value: dmStats.activeConversations, detail: "Open threads", icon: MessagesSquare },
    { label: "Awaiting your reply", value: dmStats.awaitingReply, detail: dmStats.awaitingReply ? "Needs a response" : "Nothing pending", icon: CornerUpLeft },
  ];
  const metrics = [
    { label: "Contacts", value: String(overview.contacts), detail: "Active CRM contacts", icon: UsersRound },
    { label: "Leads", value: String(overview.leads), detail: "Open leads", icon: UserPlus },
    { label: "Upcoming appointments", value: String(overview.upcomingBookings), detail: `${overview.bookingsThisMonth} booked this month`, icon: CalendarClock },
    { label: "SMS conversations", value: String(overview.smsConversations), detail: "All time", icon: MessageSquare },
    { label: "Calls this month", value: String(overview.callsThisMonth), detail: "Inbound and outbound", icon: Phone },
    { label: "Emails this month", value: String(overview.emailsThisMonth), detail: `${overview.publishedPosts} published blog posts`, icon: MailCheck },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Strategic Income Group"
        title={myName ? `Welcome back, ${profile?.firstName}` : "Dashboard overview"}
        description="Your clients, appointments, communications, and tasks in one place."
      />

      <MyTasksCard tasks={myTasks} name={myName} />

      <div className="space-y-4 border-t pt-6">
        <h2 className="text-lg font-semibold tracking-tight">Firm at a glance</h2>
        <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </StatCardRow>
        {overview.error && isAdmin ? <p className="text-xs text-muted-foreground">Some counts are unavailable: {overview.error}</p> : null}
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Direct Messages</h2>
          <Link href="/dashboard/direct-messages" className="text-xs font-medium text-primary hover:underline">Open Messages</Link>
        </div>
        <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dmCards.map((c) => (
            <Link
              key={c.label}
              href="/dashboard/direct-messages"
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-semibold tabular-nums">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">
                <c.icon className="h-5 w-5" aria-hidden />
              </span>
            </Link>
          ))}
        </StatCardRow>
      </div>

      {isAdmin && invStats ? (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Team invitations</h2>
            <Link href="/dashboard/user-management" className="text-sm font-medium text-primary hover:underline">Manage →</Link>
          </div>
          <InvitationStats counts={invStats} invitations={recentInvitations} />
        </div>
      ) : null}
    </div>
  );
}
