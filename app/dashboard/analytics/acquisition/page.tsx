import { BarList } from "@/components/analytics/bar-list";
import { duration, full, pct, rate } from "@/components/analytics/format";
import { DataTable, Panel } from "@/components/analytics/panel";
import { channelColor, DataStatusNotice, Swatch } from "@/components/analytics/report-view";
import { resolveRange } from "@/lib/analytics/dates";
import { getReport, type ChannelRow } from "@/lib/analytics/server";
import { channelLabel } from "@/lib/analytics/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AcquisitionPage({ searchParams }: Props) {
  const range = resolveRange(await searchParams);
  const { current: r, missing, error } = await getReport(range);
  const convByCampaign = new Map(r.campaign_conversions.map((c) => [c.campaign, c.conversions]));
  const channels = [...r.channels].sort((a, b) => b.visitors - a.visitors || b.conversions - a.conversions);

  return (
    <>
      <DataStatusNotice missing={missing} report={r} error={error} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Visitors by channel" description="Each visit is credited to how its session started.">
          <BarList
            valueName="visitors"
            items={channels.map((c) => ({
              key: c.channel,
              label: channelLabel(c.channel),
              value: c.visitors,
              color: channelColor(c.channel),
              note: `${full(c.conversions)} conv.`,
              extra: [`${full(c.sessions)} visits`, `${pct(rate(c.engaged_sessions, c.sessions))} engaged`, `${full(c.conversions)} conversions`],
            }))}
          />
        </Panel>
        <Panel title="Channels" description="Engagement and conversions per channel. Conversion rate = conversions ÷ visits.">
          <DataTable<ChannelRow>
            rows={channels}
            rowKey={(c) => c.channel}
            empty="No channel data for this period yet."
            columns={[
              { key: "channel", label: "Channel", render: (c) => (<span className="whitespace-nowrap"><Swatch channel={c.channel} />{channelLabel(c.channel)}</span>) },
              { key: "visitors", label: "Visitors", align: "right", render: (c) => full(c.visitors) },
              { key: "sessions", label: "Visits", align: "right", render: (c) => full(c.sessions) },
              { key: "engaged", label: "Engaged", align: "right", render: (c) => pct(rate(c.engaged_sessions, c.sessions)) },
              { key: "time", label: "Avg. time", align: "right", render: (c) => (c.sessions ? duration(c.engaged_ms / c.sessions) : "—") },
              { key: "leads", label: "Leads", align: "right", render: (c) => full(c.leads) },
              { key: "bookings", label: "Bookings", align: "right", render: (c) => full(c.bookings) },
              { key: "regs", label: "Sign-ups", align: "right", render: (c) => full(c.registrations) },
              { key: "rate", label: "Conv. rate", align: "right", render: (c) => pct(rate(c.conversions, c.sessions)) },
            ]}
          />
        </Panel>
      </div>

      <Panel title="UTM campaigns" description="Tagged links (utm_campaign) — newsletters, texts, social posts and cards. Conversions are credited by last touch.">
        <DataTable
          rows={r.campaigns}
          rowKey={(c, i) => `${c.campaign}-${c.source}-${c.medium}-${i}`}
          empty="No tagged campaign visits yet. Add utm_source, utm_medium and utm_campaign to links in emails, texts and posts to see them here."
          columns={[
            { key: "campaign", label: "Campaign", render: (c) => <span className="font-medium">{c.campaign}</span> },
            { key: "sm", label: "Source / medium", render: (c) => `${c.source || "—"} / ${c.medium || "—"}` },
            { key: "channel", label: "Channel", render: (c) => (<span className="whitespace-nowrap"><Swatch channel={c.channel} />{channelLabel(c.channel)}</span>) },
            { key: "sessions", label: "Visits", align: "right", render: (c) => full(c.sessions) },
            { key: "views", label: "Page views", align: "right", render: (c) => full(c.views) },
            { key: "conv", label: "Conversions", align: "right", render: (c) => full(convByCampaign.get(c.campaign) ?? 0) },
          ]}
        />
      </Panel>

      <Panel title="Referring sites" description="External sites that sent visitors (search engines, AI assistants, social networks and others).">
        <DataTable
          rows={r.referrers}
          rowKey={(x, i) => `${x.host}-${i}`}
          maxHeight={420}
          empty="No referred visits yet."
          columns={[
            { key: "host", label: "Site", render: (x) => x.host },
            { key: "channel", label: "Channel", render: (x) => (<span className="whitespace-nowrap"><Swatch channel={x.channel} />{channelLabel(x.channel)}</span>) },
            { key: "sessions", label: "Visits", align: "right", render: (x) => full(x.sessions) },
            { key: "views", label: "Page views", align: "right", render: (x) => full(x.views) },
          ]}
        />
      </Panel>
    </>
  );
}
