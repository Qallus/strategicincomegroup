// OAuth 2.1 helpers for the SIG MCP server. The app is its own authorization
// server: an MCP client (Claude, ChatGPT, Gemini CLI, Grok…) registers itself
// (RFC 7591), sends the signed-in SIG team member to /oauth/authorize, and
// swaps the code (PKCE S256) for an opaque bearer token. We never hand out the
// Supabase session JWT, and only SHA-256 hashes of codes/tokens are stored.
export { randomToken, sha256, verifyPkce } from "./pkce";

export const ACCESS_TTL_S = 60 * 60;             // 1 hour
export const REFRESH_TTL_S = 30 * 24 * 60 * 60;  // 30 days, rotated on use
export const CODE_TTL_S = 5 * 60;
export const MCP_SCOPE = "sig";

export const ACCESS_PREFIX = "sig_at_";
export const REFRESH_PREFIX = "sig_rt_";
export const API_TOKEN_PREFIX = "sig_pat_";
export const CLIENT_ID_PREFIX = "sig_client_";

/**
 * The public origin of this app. MCP_PUBLIC_URL wins (set it in production so
 * the advertised issuer/resource match the domain the AI client was given);
 * otherwise the request's own origin, honouring the proxy's forwarded headers.
 */
export function baseUrl(request?: Request): string {
  const configured = process.env.MCP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (request) {
    const h = request.headers;
    const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol.replace(":", "");
    if (host) return `${proto}://${host}`.replace(/\/+$/, "");
    return new URL(request.url).origin;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://strategicincomegroup.com").replace(/\/+$/, "");
}

export const mcpResourceUrl = (request?: Request) => `${baseUrl(request)}/api/mcp`;
export const resourceMetadataUrl = (request?: Request) => `${baseUrl(request)}/.well-known/oauth-protected-resource`;

// ── Redirect URIs ─────────────────────────────────────────────────────────────
// Dynamic registration is open (any MCP client may register), but the codes can
// only be sent to known AI-app hosts or to a loopback address (Gemini CLI, MCP
// Inspector, local scripts). MCP_EXTRA_REDIRECT_URIS (comma-separated, exact)
// and MCP_EXTRA_REDIRECT_HOSTS (comma-separated host names) add more.

export type ClientKind = "claude" | "chatgpt" | "gemini" | "grok" | "local" | "other";

const KNOWN_HOSTS: Record<string, ClientKind> = {
  "claude.ai": "claude",
  "claude.com": "claude",
  "chatgpt.com": "chatgpt",
  "chat.openai.com": "chatgpt",
  "platform.openai.com": "chatgpt",
  "grok.com": "grok",
  "x.ai": "grok",
  "console.x.ai": "grok",
  "gemini.google.com": "gemini",
};

const splitEnv = (name: string) => (process.env[name] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const isLoopback = (u: URL) => u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);

export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash) return false;
  if (splitEnv("MCP_EXTRA_REDIRECT_URIS").includes(uri)) return true;
  if (isLoopback(u)) return true;
  if (u.protocol !== "https:") return false;
  return u.hostname in KNOWN_HOSTS || splitEnv("MCP_EXTRA_REDIRECT_HOSTS").includes(u.hostname);
}

/** Which AI app a registration belongs to, from its redirect URIs and name. */
export function clientKindFor(uris: string[], clientName?: string | null): ClientKind {
  for (const uri of uris) {
    try {
      const u = new URL(uri);
      if (KNOWN_HOSTS[u.hostname]) return KNOWN_HOSTS[u.hostname];
    } catch { /* ignore */ }
  }
  const name = (clientName ?? "").toLowerCase();
  if (name.includes("gemini")) return "gemini";
  if (name.includes("claude")) return "claude";
  if (name.includes("chatgpt") || name.includes("openai")) return "chatgpt";
  if (name.includes("grok") || name.includes("xai")) return "grok";
  if (uris.some((uri) => { try { return isLoopback(new URL(uri)); } catch { return false; } })) return "local";
  return "other";
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

export function authServerMetadata(request?: Request) {
  const base = baseUrl(request);
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [MCP_SCOPE],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${base}/dashboard/settings/ai-connectors`,
  };
}

export function protectedResourceMetadata(request?: Request) {
  return {
    resource: mcpResourceUrl(request),
    authorization_servers: [baseUrl(request)],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Strategic Income Group (SIG)",
    resource_documentation: `${baseUrl(request)}/dashboard/settings/ai-connectors`,
  };
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
