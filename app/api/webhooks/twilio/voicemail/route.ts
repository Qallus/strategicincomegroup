import { buildVoicemailTwiml } from "@/lib/twilio/conference";
import { readTwilioWebhook, twimlResponse } from "@/lib/twilio/webhook";

// Conference mode only: the caller is redirected here when no agent answered.
// Plays the same voicemail prompt as the classic inbound flow.
export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request, { reject: "twiml" });
  if (!intake.ok) return intake.response;
  return twimlResponse(buildVoicemailTwiml());
}
