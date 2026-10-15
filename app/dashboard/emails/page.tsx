import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { EmailTabs } from "@/components/emails/email-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmailTemplateData } from "@/lib/email/templates";
import { getEmailInboxData } from "@/lib/email/inbox";

export default async function EmailsPage() {
  const [templateData, inboxData] = await Promise.all([
    getEmailTemplateData(),
    getEmailInboxData(),
  ]);
  const sentCount = templateData.logs.filter((log: any) => log.status === "sent").length;
  const failedCount = templateData.logs.filter((log: any) => log.status === "failed").length;
  const skippedCount = templateData.logs.filter((log: any) => log.status === "skipped").length;
  const totalSendCount = templateData.logs.length;
  const activeTemplateCount = templateData.templates.filter((template: any) => template.status === "active").length;
  const draftTemplateCount = templateData.templates.filter((template: any) => template.status === "draft").length;
  const archivedTemplateCount = templateData.templates.filter((template: any) => template.status === "archived").length;
  const mappedAutomationCount = templateData.mappings.filter((mapping: any) => mapping.enabled && mapping.template_id).length;
  const enabledAutomationCount = templateData.mappings.filter((mapping: any) => mapping.enabled).length;
  const unmappedAutomationCount = templateData.mappings.filter((mapping: any) => mapping.enabled && !mapping.template_id).length;
  const inboundCount = inboxData.messages.length;
  const lastInbound = inboxData.messages[0]?.received_at ? new Date(inboxData.messages[0].received_at).toLocaleString() : "No synced mail yet";
  const sendSuccessRate = totalSendCount ? Math.round((sentCount / totalSendCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <SectionHeader title="Emails" description="Email overview for templates, automations, inbox sync, and history." />
      <EmailTabs active="overview" />

      <StatCardRow className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Delivery rate" value={`${sendSuccessRate}%`} detail={`${sentCount} sent from ${totalSendCount} logged sends`} />
        <SummaryCard title="Active templates" value={activeTemplateCount} detail={`${draftTemplateCount} drafts, ${archivedTemplateCount} archived`} />
        <SummaryCard title="Mapped automations" value={mappedAutomationCount} detail={`${unmappedAutomationCount} enabled steps need templates`} />
        <SummaryCard title="Inbox messages" value={inboundCount} detail={lastInbound} />
      </StatCardRow>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Email health</CardTitle>
            <CardDescription>Quick read on sending, inbox sync, and automation readiness.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <HealthRow label="SMTP sends" value={`${sentCount} sent`} detail={`${failedCount} failed, ${skippedCount} skipped`} good={!failedCount} />
            <HealthRow label="Inbox sync" value={`${inboundCount} received`} detail={lastInbound} good={Boolean(inboundCount)} />
            <HealthRow label="Templates" value={`${activeTemplateCount} active`} detail={`${templateData.templates.length} total templates`} good={Boolean(activeTemplateCount)} />
            <HealthRow label="Automations" value={`${mappedAutomationCount}/${enabledAutomationCount || templateData.mappings.length} mapped`} detail="Enabled automations with templates assigned" good={!unmappedAutomationCount && Boolean(mappedAutomationCount)} />
          </CardContent>
        </Card>

      </div>

      {failedCount ? <p className="text-sm text-destructive">{failedCount} recent email sends failed. Review History for details.</p> : null}
    </div>
  );
}

function SummaryCard({ title, value, detail }: { title: string; value: number | string; detail: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function HealthRow({ label, value, detail, good }: { label: string; value: string; detail: string; good: boolean }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={good ? "text-sm font-semibold text-primary" : "text-sm font-semibold text-destructive"}>
          {good ? "Ready" : "Needs review"}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
