// RFC 8414 authorization server metadata for the SIG MCP OAuth server. Served
// at /.well-known/oauth-authorization-server and any path-suffixed form
// (e.g. /.well-known/oauth-authorization-server/api/mcp) older clients probe.
import { authServerMetadata, CORS_HEADERS, preflight } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(authServerMetadata(request), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  });
}

export const OPTIONS = preflight;
