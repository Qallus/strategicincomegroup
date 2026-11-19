// One mcp_audit_log row per tool call, plus a per-person rate limit. Neither
// ever throws into the tool call.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { McpCaller } from "./auth";
import { redactArgs } from "./policy";

export type AuditEntry = {
  caller: McpCaller;
  tool: string;
  args: Record<string, unknown>;
  risk: string;
  success: boolean;
  error?: string | null;
  durationMs: number;
  /** One-line description of what happened, for the dashboard. */
  summary?: string | null;
  entity?: string | null;
  recordId?: string | null;
  before?: unknown;
  after?: unknown;
  confirmationId?: string | null;
};

const SNAPSHOT_MAX = 20_000;

/** Keep before/after small enough to store; big rows keep their shape, not their text. */
function trimSnapshot(v: unknown): unknown {
  if (v == null) return null;
  const text = JSON.stringify(v);
  if (text.length <= SNAPSHOT_MAX) return v;
  if (typeof v !== "object" || Array.isArray(v)) return { truncated: true };
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = typeof val === "string" && val.length > 500 ? `${val.slice(0, 500)}…` : val;
  }
  return out;
}

export async function logToolCall(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await createSupabaseAdminClient().from("mcp_audit_log").insert({
      profile_id: entry.caller.profile.id,
      auth_kind: entry.caller.authKind,
      token_id: entry.caller.tokenId,
      client_id: entry.caller.clientId,
      client_kind: entry.caller.clientKind,
      client_name: entry.caller.clientName,
      tool: entry.tool,
      risk: entry.risk,
      args: redactArgs(entry.args),
      summary: entry.summary ? entry.summary.slice(0, 300) : null,
      success: entry.success,
      error: entry.error ? entry.error.slice(0, 500) : null,
      duration_ms: entry.durationMs,
      entity: entry.entity ?? null,
      record_id: entry.recordId ?? null,
      before: trimSnapshot(entry.before),
      after: trimSnapshot(entry.after),
      confirmation_id: entry.confirmationId ?? null,
    });
    if (error) console.error("[mcp] audit log write failed", error.message);
  } catch (err) {
    console.error("[mcp] audit log write failed", err);
  }
}

// In-memory token bucket per person. Fine for a single app container; move to
// Postgres/Redis if the app ever runs more than one instance.
const RATE_PER_MIN = Number(process.env.MCP_RATE_PER_MIN) || 120;
const buckets = new Map<string, { tokens: number; at: number }>();

export function takeRateToken(profileId: string): boolean {
  const now = Date.now();
  const b = buckets.get(profileId) ?? { tokens: RATE_PER_MIN, at: now };
  b.tokens = Math.min(RATE_PER_MIN, b.tokens + ((now - b.at) / 60_000) * RATE_PER_MIN);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(profileId, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(profileId, b);
  return true;
}
