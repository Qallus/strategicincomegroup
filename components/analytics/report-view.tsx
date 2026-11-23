// Server-side helpers that shape a Report for the charts, plus shared notices.
import { Database, Sparkles } from "lucide-react";
import { eachDay, type ResolvedRange } from "@/lib/analytics/dates";
import type { Report } from "@/lib/analytics/server";
import { CHANNEL_LABELS, type Channel } from "@/lib/analytics/types";
import { CHANNEL_SLOT, CHART_CHANNELS, OTHER } from "./colors";
import { Notice } from "./panel";
import type { TrendSeries } from "./trend-chart";

export function channelTrend(report: Report, range: ResolvedRange, metric: "visitors" | "views" | "conversions" = "visitors"): { days: string[]; series: TrendSeries[] } {
  const days = eachDay(range.from, range.to);
  const idx = new Map(days.map((d, i) => [d, i]));
  const by = new Map<string, number[]>();
  for (const row of report.trend) {
    if (row.channel === "*") continue;
    const i = idx.get(String(row.day).slice(0, 10));
    if (i == null) continue;
    const key = (CHART_CHANNELS as string[]).includes(row.channel) ? row.channel : "other";
    const arr = by.get(key) ?? new Array(days.length).fill(0);
    arr[i] += Number(row[metric] ?? 0);
    by.set(key, arr);
  }
  const series: TrendSeries[] = CHART_CHANNELS.filter((c) => by.has(c) && by.get(c)!.some((v) => v > 0)).map((c) => ({
    key: c,
    label: CHANNEL_LABELS[c],
    color: CHANNEL_SLOT[c],
    values: by.get(c)!,
  }));
  if (by.get("other")?.some((v) => v > 0)) series.push({ key: "other", label: "Other (SMS, cards, paid)", color: OTHER, values: by.get("other")! });
  return { days, series };
}

/** Whole-site daily values for a sparkline. */
export function totalSpark(report: Report, range: ResolvedRange, metric: "visitors" | "views" | "sessions" | "conversions"): number[] {
  const days = eachDay(range.from, range.to);
  const idx = new Map(days.map((d, i) => [d, i]));
  const out = new Array(days.length).fill(0);
  for (const row of report.trend) {
    if (row.channel !== "*") continue;
    const i = idx.get(String(row.day).slice(0, 10));
    if (i != null) out[i] = Number(row[metric] ?? 0);
  }
  return out;
}

export function channelColor(c: string): string {
  return CHANNEL_SLOT[c as Channel] ?? OTHER;
}

/** Legend-style color key for a table row (identity beside the text, never colored text). */
export function Swatch({ channel, color }: { channel?: string; color?: string }) {
  return <span className="sig-viz mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] align-middle" style={{ background: color ?? channelColor(channel ?? "") }} aria-hidden />;
}

export function comparisonLabel(range: ResolvedRange): string | undefined {
  return range.compare ? `vs previous ${range.days} days` : undefined;
}

/** Shown when the migration isn't applied or nothing has been collected yet. */
export function DataStatusNotice({ missing, report, error }: { missing: boolean; report: Report; error?: string | null }) {
  if (missing) {
    return (
      <Notice icon={Database} tone="warn" title="Analytics tables aren't in the database yet">
        Run <code className="rounded bg-muted px-1 text-xs">supabase/migrations/202611210190_analytics.sql</code> in the Supabase SQL editor. The site tracker,
        crawler log and conversion attribution start recording as soon as it&apos;s applied — everything here fills in from that moment.
      </Notice>
    );
  }
  if (error) {
    return (
      <Notice tone="warn" title="Some analytics couldn't load">
        {error}
      </Notice>
    );
  }
  if (report.totals.days_with_data === 0 && report.totals.conversions === 0) {
    return (
      <Notice icon={Sparkles} title="Collecting — no visits recorded for this period yet">
        The cookieless tracker records visits on the live site (never localhost, the preview host or signed-in staff). Rollups refresh every 15 minutes, so the
        first numbers appear shortly after the first visitors arrive.
      </Notice>
    );
  }
  return null;
}
