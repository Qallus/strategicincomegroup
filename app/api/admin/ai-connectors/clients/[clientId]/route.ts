// Disconnect an OAuth app: revoke every token it holds for the signed-in person.
import { NextResponse } from "next/server";
import { revokeClientForProfile } from "@/lib/mcp/connections";
import { errorStatus, requireConnectorUser } from "@/lib/mcp/dashboard-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await params;
    const body = (await request.json().catch(() => ({}))) as { actionToken?: string };
    const me = await requireConnectorUser(request, body.actionToken);
    const revoked = await revokeClientForProfile(me.id, decodeURIComponent(clientId));
    return NextResponse.json({ ok: true, revoked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't disconnect the app.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
