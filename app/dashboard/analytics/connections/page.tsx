import { relativeTime } from "@/components/analytics/format";
import { Notice, StatusPill } from "@/components/analytics/panel";
import { Card, CardContent } from "@/components/ui/card";
import { getConnections } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

const PHASES: Record<number, string> = { 1: "Phase 1 · Foundation", 2: "Phase 2 · Google", 3: "Phase 3 · Email & SMS", 4: "Phase 4 · Social & Siggy" };

export default async function ConnectionsPage() {
  const { connections, migrationMissing } = await getConnections();
  const phases = [...new Set(connections.map((c) => c.phase))].sort();
  return (
    <>
      {migrationMissing ? (
        <Notice tone="warn" title="Analytics tables aren't in the database yet">
          Run <code className="rounded bg-muted px-1 text-xs">supabase/migrations/202611210190_analytics.sql</code> in the Supabase SQL editor to switch on Phase 1.
        </Notice>
      ) : null}
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every source feeding Analytics, its status and when it last reported. Keys and secrets live only in Coolify environment variables. This page shows whether
        they are set, never their values.
      </p>
      {phases.map((ph) => (
        <section key={ph} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{PHASES[ph] ?? `Phase ${ph}`}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {connections
              .filter((c) => c.phase === ph)
              .map((c) => (
                <Card key={c.key}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{c.name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{c.detail}</p>
                      </div>
                      <StatusPill status={c.status} />
                    </div>
                    {c.lastSync ? <p className="text-xs text-muted-foreground">Last activity {relativeTime(c.lastSync)}</p> : null}
                    {c.status !== "live" && c.steps.length ? (
                      <ol className="list-decimal space-y-1 rounded-md bg-muted/40 py-2 pl-8 pr-3 text-sm">
                        {c.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
