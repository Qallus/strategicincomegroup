import { MailOpen } from "lucide-react";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { full, pct, rate } from "@/components/analytics/format";
import { Notice, NotConnected } from "@/components/analytics/panel";
import { StatTile } from "@/components/analytics/stat-tile";
import { resolveRange } from "@/lib/analytics/dates";
import { getMessaging, getReport } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EmailSmsPage({ searchParams }: Props) {
  const range = resolveRange(await searchParams);
  const [m, { current: r }] = await Promise.all([getMessaging(range), getReport(range)]);
  const email = r.channels.find((c) => c.channel === "email");
  const sms = r.channels.find((c) => c.channel === "sms");
  const emailTotal = m.email.sent + m.email.failed;
  const smsOut = m.sms.delivered + m.sms.sent + m.sms.failed;
  return (
    <>
      {m.error ? (
        <Notice tone="warn" title="Some message counts couldn't load">
          {m.error}
        </Notice>
      ) : null}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Email</h2>
        <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Emails sent" value={full(m.email.sent)} detail={`${full(m.email.queued)} queued · ${full(m.email.skipped)} skipped`} />
          <StatTile label="Send failures" value={full(m.email.failed)} detail={`${pct(rate(m.email.failed, emailTotal))} of attempts`} />
          <StatTile label="Site visitors from email" value={full(email?.visitors ?? 0)} detail="utm_medium=email or webmail referrers" />
          <StatTile label="Conversions from email" value={full(email?.conversions ?? 0)} detail="Credited by last touch" />
        </StatCardRow>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">SMS</h2>
        <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Texts delivered" value={full(m.sms.delivered)} detail={`${pct(rate(m.sms.delivered, smsOut))} delivery rate`} />
          <StatTile label="Failed / undelivered" value={full(m.sms.failed)} detail={`${full(m.sms.sent)} still in flight`} />
          <StatTile label="Replies received" value={full(m.sms.inbound)} detail="Inbound texts" />
          <StatTile label="Site visitors from SMS" value={full(sms?.visitors ?? 0)} detail={`${full(sms?.conversions ?? 0)} conversions`} />
        </StatCardRow>
      </section>
      <NotConnected
        icon={MailOpen}
        phase={3}
        title="Opens, clicks, bounces & short links"
        description="Sends and Twilio delivery are counted today. Phase 3 adds Resend's delivery events and SIG short links, so every email and text shows what happened after it went out."
        preview={[
          "Delivered, opened (labelled estimated: Apple Mail opens emails automatically), clicked, bounced and spam complaints",
          "Results per template and per campaign",
          "SMS link clicks and opt-outs",
          "SIG short links (/r/code) for texts, emails and posts",
        ]}
        steps={[
          "In Resend, create a webhook pointing at https://strategicincomegroup.com/api/webhooks/resend (all email events).",
          "Copy its signing secret into RESEND_WEBHOOK_SECRET in Coolify.",
        ]}
      />
    </>
  );
}
