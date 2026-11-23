import { Download } from "lucide-react";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { BarList } from "@/components/analytics/bar-list";
import { full } from "@/components/analytics/format";
import { DataTable, Notice, Panel } from "@/components/analytics/panel";
import { channelColor, Swatch } from "@/components/analytics/report-view";
import { StatTile } from "@/components/analytics/stat-tile";
import { resolveRange } from "@/lib/analytics/dates";
import { CONVERSION_KIND_LABELS, countBy, getConversions, type Conversion } from "@/lib/analytics/server";
import { channelLabel } from "@/lib/analytics/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function ConversionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const { rows, error } = await getConversions(range);
  const kinds = countBy(rows, (r) => r.kind);
  const n = (k: Conversion["kind"]) => kinds.find((x) => x.key === k)?.count ?? 0;
  const byType = countBy(rows.filter((r) => r.kind === "lead"), (r) => r.type);
  const byPlanner = countBy(rows.filter((r) => r.kind === "booking"), (r) => r.detail || r.type);
  const byChannel = countBy(rows, (r) => r.channel);
  const attributed = rows.filter((r) => r.source || r.channel !== "direct").length;
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();

  return (
    <>
      {error ? (
        <Notice tone="warn" title="Some conversions couldn't load">
          {error}
        </Notice>
      ) : null}
      {rows.length > 0 && attributed === 0 ? (
        <Notice title="Attribution starts with the analytics migration">
          Conversions before 202611210190_analytics.sql was applied have no first/last touch, so they show as Direct.
        </Notice>
      ) : null}

      <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Leads" value={full(n("lead"))} detail="Website forms" />
        <StatTile label="Bookings" value={full(n("booking"))} detail="Booked online" />
        <StatTile label="Event sign-ups" value={full(n("registration"))} detail="Registrations & waitlist" />
        <StatTile label="Card leads" value={full(n("card_lead"))} detail="Digital business cards" />
      </StatCardRow>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="By form type" description="Including Investment Committee and careers.">
          <BarList valueName="leads" emptyText="No form leads in this period." items={byType.map((x) => ({ key: x.key, label: x.key, value: x.count }))} />
        </Panel>
        <Panel title="By planner" description="Online bookings per booking page host.">
          <BarList valueName="bookings" emptyText="No bookings in this period." items={byPlanner.map((x) => ({ key: x.key, label: x.key, value: x.count }))} />
        </Panel>
        <Panel title="By channel" description="Credited by last touch.">
          <BarList
            valueName="conversions"
            emptyText="No conversions in this period."
            items={byChannel.map((x) => ({ key: x.key, label: channelLabel(x.key), value: x.count, color: channelColor(x.key) }))}
          />
        </Panel>
      </div>

      <Panel
        title="Recent conversions"
        description="Every lead, booking, sign-up and card lead with where it came from."
        action={
          <a
            href={`/api/admin/analytics/export${qs ? `?${qs}` : ""}`}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
          </a>
        }
      >
        <DataTable
          rows={rows.slice(0, 200)}
          rowKey={(r) => `${r.kind}-${r.id}`}
          maxHeight={600}
          empty="No conversions in this period yet."
          columns={[
            { key: "when", label: "When", className: "whitespace-nowrap", render: (r) => when(r.created_at) },
            { key: "kind", label: "Kind", render: (r) => CONVERSION_KIND_LABELS[r.kind] },
            { key: "type", label: "What", render: (r) => (<span><span className="font-medium">{r.type}</span>{r.detail ? <span className="block text-xs text-muted-foreground">{r.detail}</span> : null}</span>) },
            { key: "channel", label: "Channel", render: (r) => (<span className="whitespace-nowrap"><Swatch channel={r.channel} />{channelLabel(r.channel)}</span>) },
            { key: "source", label: "Source / campaign", render: (r) => [r.source, r.campaign].filter(Boolean).join(" · ") || "—" },
            { key: "landing", label: "Landing page", className: "max-w-[200px] break-all", render: (r) => r.landing_path ?? "—" },
          ]}
        />
      </Panel>
    </>
  );
}
