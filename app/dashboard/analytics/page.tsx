import { ArrowDownRight, ArrowUpRight, Bot, Sparkles } from "lucide-react";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { Funnel } from "@/components/analytics/funnel";
import { compact, full, pct, rate } from "@/components/analytics/format";
import { Panel } from "@/components/analytics/panel";
import { channelTrend, comparisonLabel, DataStatusNotice, totalSpark } from "@/components/analytics/report-view";
import { StatTile } from "@/components/analytics/stat-tile";
import { TrendChart } from "@/components/analytics/trend-chart";
import { resolveRange } from "@/lib/analytics/dates";
import { delta, getReport, type Report } from "@/lib/analytics/server";
import { channelLabel } from "@/lib/analytics/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function changes(cur: Report, prev: Report | null): { up: boolean; text: string }[] {
  if (!prev) return [];
  const out: { up: boolean; text: string; weight: number }[] = [];
  const prevBy = new Map(prev.channels.map((c) => [c.channel, c]));
  for (const c of cur.channels) {
    const p = prevBy.get(c.channel);
    const before = p?.visitors ?? 0;
    const diff = c.visitors - before;
    if (Math.abs(diff) >= 3) {
      const d = delta(c.visitors, before);
      out.push({
        up: diff > 0,
        weight: Math.abs(diff),
        text: `${channelLabel(c.channel)} visitors ${diff > 0 ? "up" : "down"} ${full(Math.abs(diff))}${d != null ? ` (${diff > 0 ? "+" : ""}${pct(d, 0)})` : before === 0 ? " — new this period" : ""}`,
      });
    }
  }
  for (const p of prev.channels) {
    if (!cur.channels.some((c) => c.channel === p.channel) && p.visitors >= 3) {
      out.push({ up: false, weight: p.visitors, text: `No ${channelLabel(p.channel)} visits this period (${full(p.visitors)} before)` });
    }
  }
  const cd = cur.totals.conversions - prev.totals.conversions;
  if (cd !== 0) out.push({ up: cd > 0, weight: Math.abs(cd) * 10, text: `${full(Math.abs(cd))} ${cd > 0 ? "more" : "fewer"} conversions than the previous period` });
  return out.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

export default async function AnalyticsOverviewPage({ searchParams }: Props) {
  const range = resolveRange(await searchParams);
  const { current: r, previous: p, missing, error } = await getReport(range);
  const t = r.totals;
  const cmp = comparisonLabel(range);
  const convRate = rate(t.conversions, t.sessions);
  const prevRate = p ? rate(p.totals.conversions, p.totals.sessions) : null;
  const top = [...r.channels].sort((a, b) => b.visitors - a.visitors)[0];
  const trend = channelTrend(r, range);
  const callouts = changes(r, p);
  const ai = r.channels.find((c) => c.channel === "ai_assistant");
  const crawls = r.bots.reduce((s, b) => s + b.hits, 0);

  return (
    <>
      <DataStatusNotice missing={missing} report={r} error={error} />

      <StatCardRow className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatTile label="Visitors" value={compact(t.visitors)} delta={delta(t.visitors, p?.totals.visitors)} comparison={cmp} spark={totalSpark(r, range, "visitors")} detail={`${compact(t.views)} page views`} />
        <StatTile label="Leads" value={full(t.leads)} delta={delta(t.leads, p?.totals.leads)} comparison={cmp} detail="Contact, newsletter & card forms" />
        <StatTile label="Bookings" value={full(t.bookings)} delta={delta(t.bookings, p?.totals.bookings)} comparison={cmp} detail="Planner appointments booked online" />
        <StatTile label="Event sign-ups" value={full(t.registrations)} delta={delta(t.registrations, p?.totals.registrations)} comparison={cmp} detail="Registrations & waitlist" />
        <StatTile
          label="Conversion rate"
          value={pct(convRate)}
          delta={convRate != null && prevRate != null && prevRate > 0 ? ((convRate - prevRate) / prevRate) * 100 : null}
          comparison={cmp}
          detail="Conversions per visit"
        />
        <StatTile label="Top channel" value={top ? channelLabel(top.channel) : "—"} detail={top ? `${compact(top.visitors)} visitors · ${full(top.conversions)} conversions` : "Waiting for visits"} />
      </StatCardRow>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Visitors by channel" description="Daily unique visitors. Hover for every channel on a day; switch to the table for exact values.">
          {trend.series.length ? (
            <TrendChart days={trend.days} series={trend.series} valueName="Visitors" />
          ) : (
            <p className="rounded-md border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">The trend appears once the first visits are rolled up.</p>
          )}
        </Panel>
        <Panel title="Funnel" description="Visits that engaged (2+ pages or 10s+), then became a lead or a booking.">
          <Funnel
            steps={[
              { label: "Visits", value: t.sessions },
              { label: "Engaged visits", value: t.engaged_sessions },
              { label: "Leads", value: t.leads, hint: "forms" },
              { label: "Bookings", value: t.bookings },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="What changed" description={range.compare ? `Compared with the previous ${range.days} days.` : "Turn on comparison to see what changed."}>
          {callouts.length ? (
            <ul className="space-y-2 text-sm">
              {callouts.map((c) => (
                <li key={c.text} className="flex items-start gap-2">
                  {c.up ? (
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-label="Up" />
                  ) : (
                    <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0 text-destructive dark:text-red-400" aria-label="Down" />
                  )}
                  {c.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No notable changes yet — callouts appear once there are two periods of data to compare.</p>
          )}
        </Panel>
        <Panel title="AI visibility" description="Visits sent by AI assistants and how often AI crawlers read the site.">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-primary" aria-hidden />
              <div>
                <p className="text-2xl font-semibold">{full(ai?.visitors ?? 0)}</p>
                <p className="text-xs text-muted-foreground">AI assistant visitors · {full(ai?.conversions ?? 0)} conversions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Bot className="mt-1 h-5 w-5 text-primary" aria-hidden />
              <div>
                <p className="text-2xl font-semibold">{compact(crawls)}</p>
                <p className="text-xs text-muted-foreground">Crawler page reads · {r.bots.length} bots</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
