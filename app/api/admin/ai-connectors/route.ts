// Settings → AI Connectors: the signed-in person's connected apps, API tokens
// and recent AI activity (admins may ask for the whole team's activity).
import { NextResponse } from "next/server";
import { listApiTokens, listConnectedClients, recentAudit } from "@/lib/mcp/connections";
import { errorStatus, requireConnectorUser } from "@/lib/mcp/dashboard-auth";
import { canUseArea } from "@/lib/mcp/policy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const me = await requireConnectorUser(request);
    const everyone = new URL(request.url).searchParams.get("scope") === "team" && canUseArea(me.role, "admin");
    const [clients, tokens, audit] = await Promise.all([
      listConnectedClients(me.id),
      listApiTokens(me.id),
      recentAudit({ profileId: everyone ? undefined : me.id, limit: 40 }),
    ]);
    return NextResponse.json({ clients, tokens, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't load AI connectors.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
