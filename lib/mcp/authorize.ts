// Validation and code issuing for /oauth/authorize, shared by the consent page
// (GET) and the decision handler (POST /api/oauth/authorize).
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CODE_TTL_S, MCP_SCOPE, randomToken, sha256 } from "./oauth";

export type AuthorizeParams = {
  response_type?: string; client_id?: string; redirect_uri?: string; state?: string;
  code_challenge?: string; code_challenge_method?: string; scope?: string; resource?: string;
};

export const AUTHORIZE_PARAM_KEYS: (keyof AuthorizeParams)[] = [
  "response_type", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource",
];

export type AuthorizeRequest = {
  clientId: string; clientName: string; clientKind: string; redirectUri: string; state: string | null;
  codeChallenge: string; scope: string; resource: string | null;
};

/**
 * `redirectable` errors go back to the client's redirect_uri; the others (bad
 * client or redirect URI) must be shown on our page, never redirected.
 */
export type AuthorizeCheck =
  | { ok: true; req: AuthorizeRequest }
  | { ok: false; redirectable: false; message: string }
  | { ok: false; redirectable: true; redirectUri: string; state: string | null; error: string; message: string };

export function pickAuthorizeParams(source: Record<string, unknown>): AuthorizeParams {
  const out: AuthorizeParams = {};
  for (const key of AUTHORIZE_PARAM_KEYS) {
    const v = source[key];
    if (typeof v === "string" && v) out[key] = v;
  }
  return out;
}

export async function checkAuthorizeParams(p: AuthorizeParams): Promise<AuthorizeCheck> {
  if (!p.client_id) return { ok: false, redirectable: false, message: "Missing client_id." };
  const { data: client } = await createSupabaseAdminClient()
    .from("mcp_oauth_clients")
    .select("client_id, client_name, client_kind, redirect_uris")
    .eq("client_id", p.client_id)
    .maybeSingle();
  if (!client) {
    return { ok: false, redirectable: false, message: "This app isn't registered with SIG. Remove the connector in your AI app and add it again." };
  }

  const uris = (client.redirect_uris ?? []) as string[];
  const redirectUri = p.redirect_uri || (uris.length === 1 ? uris[0] : "");
  if (!redirectUri || !uris.includes(redirectUri)) {
    return { ok: false, redirectable: false, message: "The redirect address doesn't match this app's registration." };
  }

  const state = p.state ?? null;
  const back = (error: string, message: string) => ({ ok: false as const, redirectable: true as const, redirectUri, state, error, message });
  if (p.response_type !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  if (!p.code_challenge || p.code_challenge_method !== "S256") return back("invalid_request", "PKCE with S256 is required.");

  return {
    ok: true,
    req: {
      clientId: client.client_id as string,
      clientName: (client.client_name as string) || "MCP client",
      clientKind: (client.client_kind as string) || "other",
      redirectUri,
      state,
      codeChallenge: p.code_challenge,
      scope: MCP_SCOPE,
      resource: p.resource ?? null,
    },
  };
}

export function redirectWith(uri: string, params: Record<string, string | null>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

export async function issueCode(req: AuthorizeRequest, profileId: string): Promise<string> {
  const code = randomToken();
  const { error } = await createSupabaseAdminClient().from("mcp_oauth_codes").insert({
    code_hash: sha256(code),
    client_id: req.clientId,
    profile_id: profileId,
    code_challenge: req.codeChallenge,
    redirect_uri: req.redirectUri,
    scope: req.scope,
    resource: req.resource,
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  });
  if (error) throw error;
  return code;
}
