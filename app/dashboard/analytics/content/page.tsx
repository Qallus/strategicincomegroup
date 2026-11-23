import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { BarList } from "@/components/analytics/bar-list";
import { duration, full, pct, rate } from "@/components/analytics/format";
import { DataTable, Panel, type Column } from "@/components/analytics/panel";
import { comparisonLabel, DataStatusNotice } from "@/components/analytics/report-view";
import { StatTile } from "@/components/analytics/stat-tile";
import { resolveRange } from "@/lib/analytics/dates";
import { delta, getReport, type PageRow } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type Row = PageRow & { avg_scroll: number | null; avg_engaged_ms: number | null };

const clickLabel: Record<string, string> = { click_tel: "Phone taps", click_mailto: "Email taps", click_outbound: "Outbound clicks" };

export default async function ContentPage({ searchParams }: Props) {
  const range = resolveRange(await searchParams);
  const { current: r, previous: p, missing, error } = await getReport(range);
  const cmp = comparisonLabel(range);
  const eng = new Map(r.page_engagement.map((e) => [e.path, e]));
  const rows: Row[] = r.pages
    .filter((x) => x.path !== "(unknown)")
    .map((x) => ({ ...x, avg_scroll: eng.get(x.path)?.avg_scroll ?? null, avg_engaged_ms: eng.get(x.path)?.avg_engaged_ms ?? null }));
  const clicks = (k: string, rep = r) => rep.clicks.find((c) => c.event === k)?.clicks ?? 0;

  const columns: Column<Row>[] = [
    { key: "path", label: "Page", className: "max-w-[320px] break-all", render: (x) => x.path },
    { key: "views", label: "Views", align: "right", render: (x) => full(x.views) },
    { key: "visitors", label: "Visitors", align: "right", render: (x) => full(x.visitors) },
    { key: "engaged", label: "Engaged", align: "right", render: (x) => pct(rate(x.engaged_sessions, x.sessions)) },
    { key: "time", label: "Avg. time", align: "right", render: (x) => (x.avg_engaged_ms != null ? duration(x.avg_engaged_ms) : "—") },
    { key: "scroll", label: "Avg. scroll", align: "right", render: (x) => (x.avg_scroll != null ? `${x.avg_scroll}%` : "—") },
    { key: "conv", label: "Conversions", align: "right", render: (x) => full(x.conversions) },
  ];

  const posts = rows.filter((x) => x.path.startsWith("/resources/"));
  const eventsJobs = rows.filter((x) => x.path.startsWith("/events") || x.path.startsWith("/join-our-team") || x.path.startsWith("/book"));

  return (
    <>
      <DataStatusNotice missing={missing} report={r} error={error} />

      <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Page views" value={full(r.totals.views)} delta={delta(r.totals.views, p?.totals.views)} comparison={cmp} />
        {(["click_tel", "click_mailto", "click_outbound"] as const).map((k) => (
          <StatTile key={k} label={clickLabel[k]} value={full(clicks(k))} delta={p ? delta(clicks(k), clicks(k, p)) : null} comparison={cmp} />
        ))}
      </StatCardRow>

      <Panel title="Top pages" description="Views and engagement per page. Conversions are credited to the page the visit landed on.">
        <DataTable rows={rows.slice(0, 50)} rowKey={(x) => x.path} columns={columns} maxHeight={560} empty="No page views recorded for this period yet." />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Blog posts" description="Resources & Strategic Insights articles.">
          <DataTable rows={posts.slice(0, 30)} rowKey={(x) => x.path} columns={columns.filter((c) => c.key !== "visitors")} maxHeight={480} empty="No article views yet." />
        </Panel>
        <Panel title="Events, booking & careers pages">
          <DataTable rows={eventsJobs.slice(0, 30)} rowKey={(x) => x.path} columns={columns.filter((c) => c.key !== "visitors")} maxHeight={480} empty="No event, booking or job page views yet." />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Outbound links" description="External links visitors clicked (e.g. Form ADV, maps, social).">
          <BarList valueName="clicks" emptyText="No outbound clicks yet." items={r.outbound.map((o) => ({ key: o.target, label: o.target, value: o.clicks }))} />
        </Panel>
        <Panel title="Devices" description="Share of visits by device class.">
          <BarList
            valueName="visits"
            emptyText="No visits yet."
            items={r.devices.map((d) => ({
              key: d.device,
              label: d.device.charAt(0).toUpperCase() + d.device.slice(1),
              value: d.sessions,
              note: pct(rate(d.sessions, r.devices.reduce((s, x) => s + x.sessions, 0)), 0),
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
