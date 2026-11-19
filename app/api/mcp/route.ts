// The SIG MCP server (Streamable HTTP, stateless). Claude, ChatGPT, Gemini CLI
// and Grok/xAI connect here; see docs/MCP_CONNECTOR.md. Auth is our own OAuth
// (lib/mcp/oauth.ts) or a personal API token: no/invalid token → 401 with the
// resource metadata URL in WWW-Authenticate so the client starts sign-in.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { McpAuthError, resolveMcpCaller } from "@/lib/mcp/auth";
import { CORS_HEADERS, MCP_SCOPE, preflight, resourceMetadataUrl } from "@/lib/mcp/oauth";
import { buildMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function unauthorized(request: Request, err: McpAuthError): Response {
  const code = err.status === 403 ? "insufficient_scope" : "invalid_token";
  const description = err.message.replace(/["\\]/g, "'");
  return withCors(
    new Response(JSON.stringify({ error: code, error_description: err.message }), {
      status: err.status,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="sig", error="${code}", error_description="${description}", scope="${MCP_SCOPE}", resource_metadata="${resourceMetadataUrl(request)}"`,
      },
    }),
  );
}

async function handle(request: Request): Promise<Response> {
  let caller;
  try {
    caller = await resolveMcpCaller(request);
  } catch (err) {
    if (err instanceof McpAuthError) return unauthorized(request, err);
    console.error("[mcp] auth failed", err);
    return withCors(Response.json({ error: "server_error" }, { status: 500 }));
  }

  const server = buildMcpServer(caller);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    // Stateless: nothing outlives the request.
    void transport.close().catch(() => {});
    void server.close().catch(() => {});
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = preflight;
