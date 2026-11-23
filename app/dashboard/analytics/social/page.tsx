import { Share2 } from "lucide-react";
import { StatCardRow } from "@/components/dashboard/stat-card-row";
import { full, pct, rate } from "@/components/analytics/format";
import { NotConnected } from "@/components/analytics/panel";
import { comparisonLabel } from "@/components/analytics/report-view";
import { StatTile } from "@/components/analytics/stat-tile";
import { resolveRange } from "@/lib/analytics/dates";
import { delta, getReport } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SocialTabPage({ searchParams }: Props) {
  const range = resolveRange(await searchParams);
  const { current: r, previous: p } = await getReport(range);
  const s = r.channels.find((c) => c.channel === "social");
  const sp = p?.channels.find((c) => c.channel === "social");
  const cmp = comparisonLabel(range);
  return (
    <>
      <StatCardRow className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Site visitors from social"
          value={full(s?.visitors ?? 0)}
          delta={delta(s?.visitors ?? 0, p ? sp?.visitors ?? 0 : null)}
          comparison={cmp}
          detail="Facebook, Instagram, LinkedIn, X, YouTube"
        />
        <StatTile label="Engaged visits" value={pct(rate(s?.engaged_sessions ?? 0, s?.sessions ?? 0))} detail="2+ pages or 10s+ on site" />
        <StatTile label="Conversions from social" value={full(s?.conversions ?? 0)} detail="Credited by last touch" />
      </StatCardRow>
      <NotConnected
        icon={Share2}
        phase={4}
        title="Facebook, Instagram & LinkedIn insights"
        description="Visits from social already count above. Connecting the accounts adds what happens on the platforms themselves, and makes scheduled publishing live."
        preview={["Followers and engagement per account over time", "Reach and impressions", "Top posts by engagement", "Site visits and conversions from each post's links"]}
        steps={[
          "Create a Meta Business app and connect the SIG Facebook Page and Instagram professional account.",
          "Give the app page admin access and set the META_* variables in Coolify.",
          "Create a LinkedIn app and apply for the Community Management API (LinkedIn's review takes weeks).",
          "Set the LINKEDIN_* variables in Coolify once LinkedIn approves.",
        ]}
      />
    </>
  );
}
