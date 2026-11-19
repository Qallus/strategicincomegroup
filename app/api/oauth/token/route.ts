// Token endpoint: authorization_code (PKCE S256) and refresh_token (rotated).
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ACCESS_PREFIX, ACCESS_TTL_S, CORS_HEADERS, MCP_SCOPE, REFRESH_PREFIX, REFRESH_TTL_S, preflight, randomToken, sha256, verifyPkce,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache" };
const err = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers: NO_STORE });

async function readParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v ?? "")]));
  }
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

/** client_id/secret from HTTP Basic (client_secret_basic) or the body. */
function clientCredentials(request: Request, p: Record<string, string>) {
  const basic = request.headers.get("authorization")?.match(/^Basic\s+(.+)$/i)?.[1];
  if (basic) {
    try {
      const [id, secret] = Buffer.from(basic, "base64").toString("utf8").split(":");
      return { clientId: decodeURIComponent(id ?? ""), secret: decodeURIComponent(secret ?? "") };
    } catch {
      /* fall through */
    }
  }
  return { clientId: p.client_id ?? "", secret: p.client_secret ?? "" };
}

/** Confidential clients must prove their secret; public clients rely on PKCE. */
async function authenticateClient(clientId: string, secret: string): Promise<string | null> {
  const { data } = await createSupabaseAdminClient()
    .from("mcp_oauth_clients")
    .select("client_id, client_secret_hash")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return "Unknown client_id.";
  if (data.client_secret_hash && sha256(secret) !== data.client_secret_hash) return "Client authentication failed.";
  return null;
}

async function issue(clientId: string, profileId: string, scope: string) {
  const access = `${ACCESS_PREFIX}${randomToken()}`;
  const refresh = `${REFRESH_PREFIX}${randomToken()}`;
  const now = Date.now();
  const { error } = await createSupabaseAdminClient().from("mcp_oauth_tokens").insert({
    token_hash: sha256(access),
    refresh_hash: sha256(refresh),
    client_id: clientId,
    profile_id: profileId,
    scope,
    expires_at: new Date(now + ACCESS_TTL_S * 1000).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TTL_S * 1000).toISOString(),
  });
  if (error) throw error;
  return Response.json(
    { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const p = await readParams(request);
  const supabase = createSupabaseAdminClient();
  const creds = clientCredentials(request, p);

  try {
    if (p.grant_type === "authorization_code") {
      if (!p.code || !p.code_verifier || !creds.clientId) return err("invalid_request", "code, code_verifier and client_id are required.");
      const clientProblem = await authenticateClient(creds.clientId, creds.secret);
      if (clientProblem) return err("invalid_client", clientProblem, 401);

      const { data: code } = await supabase.from("mcp_oauth_codes").select("*").eq("code_hash", sha256(p.code)).maybeSingle();
      if (!code || code.used_at || new Date(code.expires_at as string).getTime() < Date.now()) return err("invalid_grant", "The code is invalid or expired.");
      if (code.client_id !== creds.clientId) return err("invalid_grant", "The code was issued to a different client.");
      if (p.redirect_uri && p.redirect_uri !== code.redirect_uri) return err("invalid_grant", "redirect_uri doesn't match.");
      if (!verifyPkce(p.code_verifier, code.code_challenge as string)) return err("invalid_grant", "PKCE verification failed.");

      // Single use: only the request that flips used_at wins.
      const { data: claimed } = await supabase
        .from("mcp_oauth_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("code_hash", code.code_hash as string)
        .is("used_at", null)
        .select("code_hash");
      if (!claimed?.length) return err("invalid_grant", "The code was already used.");

      return await issue(code.client_id as string, code.profile_id as string, (code.scope as string) || MCP_SCOPE);
    }

    if (p.grant_type === "refresh_token") {
      if (!p.refresh_token) return err("invalid_request", "refresh_token is required.");
      const { data: row } = await supabase
        .from("mcp_oauth_tokens")
        .select("id, client_id, profile_id, scope, revoked_at, refresh_expires_at")
        .eq("refresh_hash", sha256(p.refresh_token))
        .maybeSingle();
      if (!row || row.revoked_at || !row.refresh_expires_at || new Date(row.refresh_expires_at as string).getTime() < Date.now()) {
        return err("invalid_grant", "The refresh token is invalid or expired.");
      }
      if (creds.clientId && creds.clientId !== row.client_id) return err("invalid_grant", "The refresh token was issued to a different client.");
      const clientProblem = await authenticateClient(row.client_id as string, creds.secret);
      if (clientProblem) return err("invalid_client", clientProblem, 401);

      // Rotate: retire the old pair, then issue a new one. Status and role are
      // re-checked on every /api/mcp call, so a suspended account gets nothing.
      const { data: retired } = await supabase
        .from("mcp_oauth_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", row.id as string)
        .is("revoked_at", null)
        .select("id");
      if (!retired?.length) return err("invalid_grant", "The refresh token was already used.");

      return await issue(row.client_id as string, row.profile_id as string, (row.scope as string) || MCP_SCOPE);
    }

    return err("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (e) {
    console.error("[oauth] token failed", e);
    return err("server_error", "Couldn't issue a token.", 500);
  }
}

export const OPTIONS = preflight;
