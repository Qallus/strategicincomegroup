import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { generateVoiceAccessToken } from "@/lib/twilio/voice";
import { MONITOR_IDENTITY_PREFIX } from "@/lib/twilio/conference";
import { commsError } from "@/lib/twilio/http";

// Voice token for the monitor leg. A separate identity (sig-monitor-<profile id>) so joining
// a call never rings the shared agent softphone, and the voice webhook can check the session
// belongs to the admin dialling in.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireAdminManager(request, body.actionToken);
    const identity = `${MONITOR_IDENTITY_PREFIX}${actor.id}`;
    const token = await generateVoiceAccessToken(actor.id, identity);
    return NextResponse.json({ token, identity });
  } catch (error) {
    return commsError(error, "Failed to generate monitor token.");
  }
}
