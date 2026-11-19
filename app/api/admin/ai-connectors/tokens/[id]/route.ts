// Revoke one of the signed-in person's API tokens.
import { NextResponse } from "next/server";
import { revokeApiToken } from "@/lib/mcp/connections";
import { errorStatus, requireConnectorUser } from "@/lib/mcp/dashboard-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { actionToken?: string };
    const me = await requireConnectorUser(request, body.actionToken);
    const revoked = await revokeApiToken(me.id, id);
    if (!revoked) return NextResponse.json({ error: "Token not found or already revoked." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't revoke the token.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
