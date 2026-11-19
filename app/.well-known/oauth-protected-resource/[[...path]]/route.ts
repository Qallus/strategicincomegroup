// RFC 9728 protected resource metadata for the SIG MCP server. Served at
// /.well-known/oauth-protected-resource and at the path-suffixed form
// /.well-known/oauth-protected-resource/api/mcp that newer MCP clients try first.
import { CORS_HEADERS, preflight, protectedResourceMetadata } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(protectedResourceMetadata(request), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  });
}

export const OPTIONS = preflight;
