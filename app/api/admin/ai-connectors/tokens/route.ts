// Create a personal API token (shown once) for MCP clients that can't do OAuth.
import { NextResponse } from "next/server";
import { createApiToken } from "@/lib/mcp/connections";
import { errorStatus, requireConnectorUser } from "@/lib/mcp/dashboard-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      actionToken?: string; name?: string; tiers?: string[]; expiresInDays?: number | null;
    };
    const me = await requireConnectorUser(request, body.actionToken);
    const { token, row } = await createApiToken(me.id, {
      name: String(body.name ?? ""),
      tiers: Array.isArray(body.tiers) ? body.tiers.map(String) : ["read"],
      expiresInDays: typeof body.expiresInDays === "number" ? body.expiresInDays : null,
    });
    return NextResponse.json({ token, row }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't create the token.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
