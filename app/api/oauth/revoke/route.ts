// Token revocation (RFC 7009). Accepts an access or refresh token; always 200.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CORS_HEADERS, preflight, sha256 } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const params = type.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, string>)
    : Object.fromEntries(new URLSearchParams(await request.text()));
  const token = typeof params.token === "string" ? params.token.trim() : "";
  if (token) {
    const hash = sha256(token);
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    await supabase.from("mcp_oauth_tokens").update({ revoked_at: now }).eq("token_hash", hash).is("revoked_at", null);
    await supabase.from("mcp_oauth_tokens").update({ revoked_at: now }).eq("refresh_hash", hash).is("revoked_at", null);
  }
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export const OPTIONS = preflight;
