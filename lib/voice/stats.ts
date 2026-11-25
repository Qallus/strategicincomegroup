// Shared call statistics for the dashboard stat cards, the Call log widget and the dialer.
// The "missed" rule matches components/dialer/dialer-dashboard.tsx: Twilio reported
// no-answer / busy, or an inbound call ended without ever being answered (rang out to
// voicemail). Server-side module (the loaders use the service role).

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { isMissedCall, summarizeCalls, formatTalkTime, formatDuration } from "./format";
export type { CallLike, CallSummary } from "./format";
import { summarizeCalls, type CallLike, type CallSummary } from "./format";

const CALL_COLUMNS = "id, direction, status, answered_at, ended_at, duration_seconds, recording_url, voicemail_url, created_at, handled_by, from_number, to_number";

export type CallRow = CallLike & {
  id: string;
  created_at: string;
  handled_by: string | null;
  from_number: string;
  to_number: string;
};

/** Calls in [since, until), optionally only those handled by one profile. Never throws. */
export async function loadCalls(opts: { since: string; until?: string; handledBy?: string | null; limit?: number }): Promise<CallRow[]> {
  try {
    let q = createSupabaseAdminClient()
      .from("calls")
      .select(CALL_COLUMNS)
      .gte("created_at", opts.since)
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 5000);
    if (opts.until) q = q.lt("created_at", opts.until);
    if (opts.handledBy) q = q.eq("handled_by", opts.handledBy);
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []) as unknown as CallRow[];
  } catch {
    return [];
  }
}

/**
 * Monitoring sessions (listen / whisper / barge) in the period. The table comes from the
 * communications migration; before it is applied this returns 0.
 */
export async function countMonitoredSessions(opts: { since: string; until?: string; monitorId?: string | null }): Promise<number> {
  try {
    let q = createSupabaseAdminClient().from("call_monitor_sessions").select("id", { count: "exact", head: true }).gte("started_at", opts.since);
    if (opts.until) q = q.lt("started_at", opts.until);
    if (opts.monitorId) q = q.eq("monitor_profile_id", opts.monitorId);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadCallStats(opts: { since: string; until?: string; handledBy?: string | null }): Promise<CallSummary & { monitored: number }> {
  const [calls, monitored] = await Promise.all([
    loadCalls(opts),
    countMonitoredSessions({ since: opts.since, until: opts.until, monitorId: opts.handledBy ?? null }),
  ]);
  return { ...summarizeCalls(calls), monitored };
}
