// High-risk MCP actions wait here for the person's go-ahead (the two-step
// confirmation). The tool call stores its own arguments and a preview;
// sig_confirm runs exactly those stored arguments once, for the same person and
// the same app/token, within 15 minutes. Nothing the AI client sends back at
// confirm time is trusted. Server-only.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { McpCaller } from "./auth";
import { pendingProblem, PENDING_TTL_MS, type PendingRow } from "./safety";

export type Preview = {
  /** One plain sentence: what will happen. */
  summary: string;
  /** Anything the person should see before agreeing (record, fields, counts). */
  details?: Record<string, unknown>;
  entity?: string;
  recordId?: string;
};

export type PendingAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  preview: Preview;
  status: string;
  expires_at: string;
  created_at: string;
};

const COLS = "id, tool, args, preview, status, expires_at, created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createPending(
  caller: McpCaller,
  tool: string,
  args: Record<string, unknown>,
  preview: Preview,
): Promise<PendingAction> {
  const { data, error } = await createSupabaseAdminClient()
    .from("mcp_pending_actions")
    .insert({
      profile_id: caller.profile.id,
      token_id: caller.tokenId,
      client_id: caller.clientId,
      client_kind: caller.clientKind,
      tool,
      args,
      preview,
      risk: "high",
      expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(`Couldn't hold the action for confirmation: ${error?.message ?? "unknown error"}`);
  return data as unknown as PendingAction;
}

/**
 * Claim a pending action for execution. The status flip is the lock: only one
 * confirm can move it from pending, so a double call can't run it twice.
 */
export async function claimPending(id: string, caller: McpCaller): Promise<PendingAction> {
  const supabase = createSupabaseAdminClient();
  if (!UUID.test(id)) throw new Error("That confirmation id doesn't exist.");
  const who = { profileId: caller.profile.id, clientId: caller.clientId };

  const { data: claimed } = await supabase
    .from("mcp_pending_actions")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", caller.profile.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select(`${COLS}, client_id`)
    .maybeSingle();
  if (claimed && (!claimed.client_id || claimed.client_id === caller.clientId)) return claimed as unknown as PendingAction;

  const { data: row } = await supabase
    .from("mcp_pending_actions")
    .select("profile_id, status, expires_at, client_id")
    .eq("id", id)
    .maybeSingle();
  const pendingRow = (row ?? null) as PendingRow | null;

  if (claimed) {
    // Claimed from a different app or token: undo and explain.
    await supabase.from("mcp_pending_actions").update({ status: "pending", confirmed_at: null }).eq("id", id);
    throw new Error(pendingProblem(pendingRow ? { ...pendingRow, status: "pending" } : null, who) ?? "Can't confirm that here.");
  }
  if (pendingRow && pendingRow.status === "pending" && new Date(pendingRow.expires_at).getTime() <= Date.now()) {
    await supabase.from("mcp_pending_actions").update({ status: "expired" }).eq("id", id);
  }
  throw new Error(pendingProblem(pendingRow, who) ?? "Can't confirm that action.");
}

export async function finishPending(id: string, outcome: { result?: unknown; error?: string | null }): Promise<void> {
  await createSupabaseAdminClient()
    .from("mcp_pending_actions")
    .update(outcome.error ? { status: "failed", error: outcome.error.slice(0, 500) } : { result: outcome.result ?? null })
    .eq("id", id);
}

export async function cancelPending(id: string, caller: McpCaller): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const { data } = await createSupabaseAdminClient()
    .from("mcp_pending_actions")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("profile_id", caller.profile.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  return !!data;
}

export async function listPending(caller: McpCaller): Promise<PendingAction[]> {
  const { data } = await createSupabaseAdminClient()
    .from("mcp_pending_actions")
    .select(COLS)
    .eq("profile_id", caller.profile.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as unknown as PendingAction[];
}
