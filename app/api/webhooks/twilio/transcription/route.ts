import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readTwilioWebhook } from "@/lib/twilio/webhook";

// Twilio's built-in voicemail transcription (<Record transcribe>).
export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request);
  if (!intake.ok) return intake.response;
  const { hook } = intake;
  try {
    const callSid = hook.get("CallSid");
    const transcriptionSid = hook.get("TranscriptionSid");
    const transcriptionText = hook.get("TranscriptionText");

    if (!callSid) return NextResponse.json({ ok: true });

    const supabase = createSupabaseAdminClient();

    const { data: call } = await supabase
      .from("calls")
      .select("id, voicemail_transcription")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (!call) return NextResponse.json({ ok: true });

    // Only the voicemail <Record> asks Twilio to transcribe. Keep an existing (Whisper)
    // transcript; it is more accurate than Twilio's.
    if (!call.voicemail_transcription && transcriptionText) {
      await supabase.from("calls").update({
        transcription_sid: transcriptionSid || null,
        voicemail_transcription: transcriptionText,
        updated_at: new Date().toISOString(),
      }).eq("id", call.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Transcription webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
