// Dynamic client registration (RFC 7591) for MCP clients such as Claude,
// ChatGPT, Gemini CLI and Grok. Public clients by default (PKCE, no secret);
// a client that asks for client_secret_post/basic gets a secret, stored hashed.
// Redirect URIs must be on the allowlist in lib/mcp/oauth.ts, so a
// registration alone can't send codes anywhere else.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CLIENT_ID_PREFIX, CORS_HEADERS, clientKindFor, isAllowedRedirectUri, preflight, randomToken, sha256 } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const bad = (error: string, description: string) =>
  Response.json({ error, error_description: description }, { status: 400, headers: CORS_HEADERS });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("invalid_client_metadata", "Body must be JSON.");
  }

  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length) return bad("invalid_redirect_uri", "redirect_uris is required.");
  if (uris.length > 10) return bad("invalid_redirect_uri", "At most 10 redirect_uris.");
  const rejected = uris.filter((u) => !isAllowedRedirectUri(u));
  if (rejected.length) return bad("invalid_redirect_uri", `Not an allowed redirect URI: ${rejected.join(", ")}`);

  const requested = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  const method = ["client_secret_post", "client_secret_basic"].includes(requested) ? requested : "none";
  const clientSecret = method === "none" ? null : `sig_cs_${randomToken(32)}`;

  const client_id = `${CLIENT_ID_PREFIX}${randomToken(16)}`;
  const client_name = String(body.client_name ?? "MCP client").replace(/[\u0000-\u001f]/g, "").slice(0, 120) || "MCP client";
  const client_kind = clientKindFor(uris, client_name);

  const { error } = await createSupabaseAdminClient().from("mcp_oauth_clients").insert({
    client_id,
    client_name,
    client_kind,
    redirect_uris: uris,
    token_endpoint_auth_method: method,
    client_secret_hash: clientSecret ? sha256(clientSecret) : null,
    client_uri: typeof body.client_uri === "string" ? body.client_uri.slice(0, 300) : null,
    software_id: typeof body.software_id === "string" ? body.software_id.slice(0, 120) : null,
  });
  if (error) {
    console.error("[oauth] register failed", error);
    return Response.json({ error: "server_error" }, { status: 500, headers: CORS_HEADERS });
  }

  return Response.json(
    {
      client_id,
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_name,
      redirect_uris: uris,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: method,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "sig",
    },
    { status: 201, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}

export const OPTIONS = preflight;
