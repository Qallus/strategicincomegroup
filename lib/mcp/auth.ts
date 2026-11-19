// Resolve the caller of /api/mcp from its bearer token: either an OAuth access
// token (sig_at_…) issued by /api/oauth/token, or a personal API token
// (sig_pat_…) created in Settings → AI Connectors for clients that can't do
// OAuth (Grok/xAI API, scripts). Status and role are re-read from `profiles`
// on every call, so suspending someone or changing their role takes effect
// immediately.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ROLES, ROLE_LABELS, canAccessDashboard, normalizeAppRole, type AppRole } from "@/lib/rbac/roles";
import { isSelfServeRole } from "@/lib/user-management/self-registration";
import { API_TOKEN_PREFIX, type ClientKind } from "./oauth";
import { sha256 } from "./pkce";
import { RISKS, type Risk } from "./safety";

// Same owner override as lib/auth/server.ts (getCurrentProfile).
const OWNER_EMAILS = new Set(["jeremy@strategicincomegroup.com"]);

export type McpProfile = { id: string; email: string; name: string; role: AppRole; status: string };

export type McpCaller = {
  profile: McpProfile;
  /** oauth = connector sign-in; api_token = personal token from the dashboard. */
  authKind: "oauth" | "api_token";
  /** mcp_oauth_tokens.id or mcp_api_tokens.id */
  tokenId: string;
  /** OAuth client_id, or `pat:<token id>` for an API token. */
  clientId: string;
  clientKind: ClientKind | "api_token";
  clientName: string;
  /** Risk tiers this connection may use (read / write / high). */
  allowedTiers: Risk[];
};

export class McpAuthError extends Error {
  constructor(message: string, public status: 401 | 403 = 401) {
    super(message);
  }
}

/** May this person connect an AI app to SIG at all? Shared with /oauth/authorize and the dashboard. */
export function mcpAccessFor(profile: { id: string; role: string; status: string | null } | null):
  { allowed: true } | { allowed: false; reason: string } {
  if (!profile) return { allowed: false, reason: "Sign in to Strategic Income Group first." };
  if (profile.id === "local-preview") return { allowed: false, reason: "Supabase isn't configured in this environment." };
  if (profile.status !== "active") return { allowed: false, reason: "Your SIG account isn't active." };
  if (!canAccessDashboard(profile.role)) return { allowed: false, reason: "Your role doesn't include dashboard access." };
  // Participants and facilitators can self-register, so dashboard access alone
  // isn't proof they were vetted (see requireStaffPage in lib/rbac/guard.ts).
  if (isSelfServeRole(profile.role)) {
    return { allowed: false, reason: "AI connectors are available to SIG team members only." };
  }
  return { allowed: true };
}

export async function loadMcpProfile(profileId: string): Promise<McpProfile | null> {
  const { data } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id,email,first_name,last_name,role,status")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  const email = String(data.email ?? "").trim().toLowerCase();
  const isOwner = OWNER_EMAILS.has(email);
  const role = isOwner ? ROLES.SUPER_ADMIN : normalizeAppRole(data.role as string) ?? ROLES.PARTICIPANT;
  return {
    id: data.id as string,
    email: (data.email as string) ?? "",
    name: [data.first_name, data.last_name].filter(Boolean).join(" ") || (data.email as string) || "SIG team member",
    role,
    status: isOwner ? "active" : ((data.status as string) ?? "active"),
  };
}

export const roleLabel = (role: AppRole) => ROLE_LABELS[role] ?? role;

function parseTiers(value: unknown): Risk[] {
  const list = Array.isArray(value) ? value : [];
  const tiers = list.filter((t): t is Risk => (RISKS as readonly string[]).includes(String(t)));
  return tiers.length ? tiers : ["read"];
}

export async function resolveMcpCaller(request: Request): Promise<McpCaller> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw new McpAuthError("Missing bearer token.");

  const supabase = createSupabaseAdminClient();
  const hash = sha256(token);
  const now = Date.now();

  let caller: Omit<McpCaller, "profile">;
  let profileId: string;
  let lastUsed: string | null;
  let table: "mcp_api_tokens" | "mcp_oauth_tokens";

  if (token.startsWith(API_TOKEN_PREFIX)) {
    table = "mcp_api_tokens";
    const { data: row } = await supabase
      .from("mcp_api_tokens")
      .select("id, profile_id, name, allowed_tiers, expires_at, revoked_at, last_used_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!row || row.revoked_at || (row.expires_at && new Date(row.expires_at).getTime() <= now)) {
      throw new McpAuthError("Invalid, revoked or expired API token.");
    }
    profileId = row.profile_id as string;
    lastUsed = row.last_used_at as string | null;
    caller = {
      authKind: "api_token", tokenId: row.id as string, clientId: `pat:${row.id}`, clientKind: "api_token",
      clientName: (row.name as string) || "API token", allowedTiers: parseTiers(row.allowed_tiers),
    };
  } else {
    table = "mcp_oauth_tokens";
    const { data: row } = await supabase
      .from("mcp_oauth_tokens")
      .select("id, client_id, profile_id, expires_at, revoked_at, last_used_at, client:mcp_oauth_clients(client_name, client_kind)")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!row || row.revoked_at || new Date(row.expires_at as string).getTime() <= now) {
      throw new McpAuthError("Invalid or expired token.");
    }
    const client = (Array.isArray(row.client) ? row.client[0] : row.client) as { client_name?: string; client_kind?: string } | null;
    profileId = row.profile_id as string;
    lastUsed = row.last_used_at as string | null;
    caller = {
      authKind: "oauth", tokenId: row.id as string, clientId: row.client_id as string,
      clientKind: ((client?.client_kind as ClientKind) ?? "other"), clientName: client?.client_name || "MCP client",
      allowedTiers: ["read", "write", "high"],
    };
  }

  const profile = await loadMcpProfile(profileId);
  if (!profile) throw new McpAuthError("This SIG account no longer exists.", 403);
  const access = mcpAccessFor(profile);
  if (!access.allowed) throw new McpAuthError(access.reason, 403);

  // Touch at most once a minute; never block the call on it.
  if (!lastUsed || now - new Date(lastUsed).getTime() > 60_000) {
    supabase.from(table).update({ last_used_at: new Date().toISOString() }).eq("id", caller.tokenId).then(() => {}, () => {});
  }

  return { ...caller, profile };
}
