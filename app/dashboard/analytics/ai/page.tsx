import { MessageCircleQuestion } from "lucide-react";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { BarList } from "@/components/analytics/bar-list";
import { BOT_OWNER_SLOT, OTHER } from "@/components/analytics/colors";
import { compact, full, relativeTime } from "@/components/analytics/format";
import { DataTable, Notice, Panel } from "@/components/analytics/panel";
import { comparisonLabel, DataStatusNotice, Swatch } from "@/components/analytics/report-view";
import { StatTile } from "@/components/analytics/stat-tile";
import { TrendChart, type TrendSeries } from "@/components/analytics/trend-chart";
import { botKind, botOwner } from "@/lib/analytics/bots";
import { eachDay, resolveRange } from "@/lib/analytics/dates";
import { delta, getMcpUsage, getReport } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ownerColor = (owner: string) => BOT_OWNER_SLOT[owner] ?? OTHER;

export default async function AiPage({ searchParams }: Props) {
  const range = resolveRange(await searchParams);
  const [{ current: r, previous: p, missing, error }, mcp] = await Promise.all([getReport(range), getMcpUsage(range)]);
  const cmp = comparisonLabel(range);
  const ai = r.channels.find((c) => c.channel === "ai_assistant");
  const aiPrev = p?.channels.find((c) => c.channel === "ai_assistant");
  const crawls = r.bots.reduce((s, b) => s + b.hits, 0);
  const aiCrawls = r.bots.filter((b) => botKind(b.bot) === "ai").reduce((s, b) => s + b.hits, 0);
  const prevCrawls = p ? p.bots.reduce((s, b) => s + b.hits, 0) : null;

  // Crawler reads per day, one line per bot owner (fixed slots; the rest → Other).
  const days = eachDay(range.from, range.to);
  const idx = new Map(days.map((d, i) => [d, i]));
  const byOwner = new Map<string, number[]>();
  for (const row of r.bot_trend) {
    const i = idx.get(String(row.day).slice(0, 10));
    if (i == null) continue;
    const owner = BOT_OWNER_SLOT[botOwner(row.bot)] ? botOwner(row.bot) : "Other";
    const arr = byOwner.get(owner) ?? new Array(days.length).fill(0);
    arr[i] += row.hits;
    byOwner.set(owner, arr);
  }
  const series: TrendSeries[] = [...Object.keys(BOT_OWNER_SLOT), "Other"]
    .filter((o) => byOwner.has(o))
    .map((o) => ({ key: o, label: o, color: ownerColor(o), values: byOwner.get(o)! }));

  return (
    <>
      <DataStatusNotice missing={missing} report={r} error={error} />

      <StatCardRow className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="AI assistant visitors" value={full(ai?.visitors ?? 0)} delta={delta(ai?.visitors ?? 0, p ? aiPrev?.visitors ?? 0 : null)} comparison={cmp} detail="From ChatGPT, Perplexity, Gemini, Copilot, Claude…" />
        <StatTile label="AI-referred conversions" value={full(ai?.conversions ?? 0)} delta={delta(ai?.conversions ?? 0, p ? aiPrev?.conversions ?? 0 : null)} comparison={cmp} detail="Leads, bookings & sign-ups" />
        <StatTile label="Crawler page reads" value={compact(crawls)} delta={delta(crawls, prevCrawls)} comparison={cmp} detail={`${compact(aiCrawls)} by AI crawlers`} />
        <StatTile label="AI connector calls" value={full(mcp.total)} detail={mcp.total ? `${full(mcp.failures)} failed · ${mcp.clients.length} client${mcp.clients.length === 1 ? "" : "s"}` : "Claude / ChatGPT connectors (MCP)"} />
      </StatCardRow>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="AI assistant referrals" description="Visits whose session started from an AI assistant (referrer or utm_source).">
          <BarList
            valueName="visits"
            emptyText="No AI assistant referrals yet. As ChatGPT, Perplexity and others cite SIG pages, visits show up here."
            items={r.ai_sources.map((a) => ({ key: a.source, label: a.source, value: a.sessions, color: "var(--series-2)", extra: [`${full(a.visitors)} visitors`, `${full(a.views)} page views`] }))}
          />
        </Panel>
        <Panel title="Where AI visitors land" description="The pages AI assistants send people to.">
          <DataTable
            rows={r.ai_pages}
            rowKey={(x, i) => `${x.path}-${x.source}-${i}`}
            maxHeight={360}
            empty="No AI-referred landings yet."
            columns={[
              { key: "path", label: "Page", className: "max-w-[260px] break-all", render: (x) => x.path },
              { key: "source", label: "Assistant", render: (x) => x.source },
              { key: "sessions", label: "Visits", align: "right", render: (x) => full(x.sessions) },
            ]}
          />
        </Panel>
      </div>

      <Panel title="AI crawler & search bot reads" description="Server-side log of known bots fetching public pages (no visitor data). Lines group bots by company.">
        {series.length ? (
          <TrendChart days={days} series={series} valueName="Crawler page reads" height={220} />
        ) : (
          <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">No crawler visits logged for this period yet.</p>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="By bot" description="GPTBot / OAI-SearchBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot, Googlebot, Bingbot and others.">
          <DataTable
            rows={r.bots}
            rowKey={(b) => b.bot}
            empty="No bots logged yet."
            columns={[
              { key: "bot", label: "Bot", render: (b) => (<span className="whitespace-nowrap"><Swatch color={ownerColor(botOwner(b.bot))} />{b.bot}</span>) },
              { key: "owner", label: "Company", render: (b) => botOwner(b.bot) },
              { key: "kind", label: "Type", render: (b) => (botKind(b.bot) === "ai" ? "AI" : botKind(b.bot) === "search" ? "Search" : "Other") },
              { key: "hits", label: "Reads", align: "right", render: (b) => full(b.hits) },
              { key: "pages", label: "Pages", align: "right", render: (b) => full(b.pages) },
              { key: "seen", label: "Last seen", align: "right", render: (b) => relativeTime(b.last_seen_at) },
            ]}
          />
        </Panel>
        <Panel title="Most-read pages" description="Which pages bots read most — what AI engines know about SIG.">
          <DataTable
            rows={r.bot_pages}
            rowKey={(b) => b.path}
            maxHeight={420}
            empty="No pages read by bots yet."
            columns={[
              { key: "path", label: "Page", className: "max-w-[240px] break-all", render: (b) => b.path },
              { key: "bots", label: "Bots", render: (b) => <span className="text-xs text-muted-foreground">{b.bot_names}</span> },
              { key: "hits", label: "Reads", align: "right", render: (b) => full(b.hits) },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="AI connector usage" description="Calls from Claude, ChatGPT and the dashboard agent through SIG's MCP connector (mcp_audit_log).">
          <BarList
            valueName="calls"
            emptyText={mcp.error ? `Couldn't load connector usage: ${mcp.error}` : "No connector calls in this period."}
            items={mcp.clients.map((c) => ({ key: c.key, label: c.key, value: c.count, color: "var(--series-1)" }))}
          />
        </Panel>
        <Panel title="Most-used connector tools">
          <BarList valueName="calls" emptyText="No connector calls in this period." items={mcp.tools.map((c) => ({ key: c.key, label: c.key, value: c.count, color: "var(--series-1)" }))} />
        </Panel>
      </div>

      <Notice icon={MessageCircleQuestion} title="Siggy's questions arrive in Phase 4">
        Every question visitors ask Siggy — and the ones it couldn&apos;t answer — will be logged here (no names or contact details) as ideas for new articles and FAQs.
      </Notice>
    </>
  );
}
