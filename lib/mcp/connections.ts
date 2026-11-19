// Settings → AI Connectors data: a person's connected OAuth apps, their
// personal API tokens and recent AI activity. Server-only; every function is
// scoped to one profile id passed in by an authenticated route or page.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { API_TOKEN_PREFIX } from "./oauth";
import { randomToken, sha256 } from "./pkce";
import { RISKS, type Risk } from "./safety";

export type ConnectedClient = {
  client_id: string;
  client_name: string;
  client_kind: string;
  active_tokens: number;
  first_connected_at: string;
  last_used_at: string | null;
};

export type ApiTokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  allowed_tiers: Risk[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type AuditRow = {
  id: string;
  created_at: string;
  tool: string;
  risk: string | null;
  client_name: string | null;
  client_kind: string | null;
  summary: string | null;
  success: boolean;
  error: string | null;
  profile_id: string | null;
  email?: string | null;
};

const sb = () => createSupabaseAdminClient();

/** OAuth apps with at least one live (not revoked, refresh not expired) token for this person. */
export async function listConnectedClients(profileId: string): Promise<ConnectedClient[]> {
  const { data, error } = await sb()
    .from("mcp_oauth_tokens")
    .select("client_id, created_at, last_used_at, refresh_expires_at, expires_at, client:mcp_oauth_clients(client_name, client_kind)")
    .eq("profile_id", profileId)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const now = Date.now();
  const map = new Map<string, ConnectedClient>();
  for (const row of data ?? []) {
    const alive = new Date((row.refresh_expires_at as string | null) ?? (row.expires_at as string)).getTime() > now;
    if (!alive) continue;
    const client = (Array.isArray(row.client) ? row.client[0] : row.client) as { client_name?: string; client_kind?: string } | null;
    const id = row.client_id as string;
    const existing = map.get(id);
    const last = row.last_used_at as string | null;
    if (existing) {
      existing.active_tokens += 1;
      if (last && (!existing.last_used_at || last > existing.last_used_at)) existing.last_used_at = last;
    } else {
      map.set(id, {
        client_id: id,
        client_name: client?.client_name || "MCP client",
        client_kind: client?.client_kind || "other",
        active_tokens: 1,
        first_connected_at: row.created_at as string,
        last_used_at: last,
      });
    }
  }
  return [...map.values()];
}

/** Disconnect an app: revoke every token it holds for this person. */
export async function revokeClientForProfile(profileId: string, clientId: string): Promise<number> {
  const { data, error } = await sb()
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function listApiTokens(profileId: string): Promise<ApiTokenRow[]> {
  const { data, error } = await sb()
    .from("mcp_api_tokens")
    .select("id, name, token_prefix, allowed_tiers, created_at, last_used_at, expires_at, revoked_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiTokenRow[];
}

/** Create a personal API token. The plain token is returned once and never stored. */
export async function createApiToken(
  profileId: string,
  input: { name: string; tiers?: string[]; expiresInDays?: number | null },
): Promise<{ token: string; row: ApiTokenRow }> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Give the token a name (e.g. 'Grok API').");
  const tiers = (input.tiers ?? ["read"]).filter((t): t is Risk => (RISKS as readonly string[]).includes(t));
  if (!tiers.includes("read")) tiers.unshift("read");
  const days = input.expiresInDays && input.expiresInDays > 0 ? Math.min(input.expiresInDays, 365) : null;
  const { count } = await sb().from("mcp_api_tokens").select("id", { count: "exact", head: true }).eq("profile_id", profileId).is("revoked_at", null);
  if ((count ?? 0) >= 10) throw new Error("You already have 10 active tokens. Revoke one first.");

  const token = `${API_TOKEN_PREFIX}${randomToken(32)}`;
  const { data, error } = await sb()
    .from("mcp_api_tokens")
    .insert({
      profile_id: profileId,
      name,
      token_hash: sha256(token),
      token_prefix: token.slice(0, API_TOKEN_PREFIX.length + 6),
      allowed_tiers: tiers,
      expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
    })
    .select("id, name, token_prefix, allowed_tiers, created_at, last_used_at, expires_at, revoked_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't create the token.");
  return { token, row: data as ApiTokenRow };
}

export async function revokeApiToken(profileId: string, tokenId: string): Promise<boolean> {
  const { data, error } = await sb()
    .from("mcp_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("profile_id", profileId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return !!data?.length;
}

export async function recentAudit(opts: { profileId?: string; limit?: number }): Promise<AuditRow[]> {
  let q = sb()
    .from("mcp_audit_log")
    .select("id, created_at, tool, risk, client_name, client_kind, summary, success, error, profile_id, profile:profiles(email)")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 25, 100));
  if (opts.profileId) q = q.eq("profile_id", opts.profileId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const p = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as { email?: string } | null;
    const { profile: _profile, ...rest } = r as Record<string, unknown>;
    void _profile;
    return { ...(rest as unknown as AuditRow), email: p?.email ?? null };
  });
}
