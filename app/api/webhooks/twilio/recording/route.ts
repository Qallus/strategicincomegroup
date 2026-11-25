import { NextResponse, after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { transcribeRecording } from "@/lib/openai/transcribe";
import { getCommunicationSettings } from "@/lib/twilio/settings";
import { readTwilioWebhook } from "@/lib/twilio/webhook";

// Recording status callback: <Dial record> (classic flow), <Conference record> (conference
// mode — Twilio sends no CallSid there, so the TwiML adds ?call_sid=) and voicemail.
// When "Auto-transcribe recordings" is on (Dialer → Settings), the recording is transcribed
// with OpenAI after the response is sent.
export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request);
  if (!intake.ok) return intake.response;
  const { hook } = intake;

  try {
    const callSid = hook.get("CallSid") || hook.url.searchParams.get("call_sid") || "";
    const recordingSid = hook.get("RecordingSid");
    const recordingUrl = hook.get("RecordingUrl");
    const recordingDuration = hook.get("RecordingDuration") ? parseInt(hook.get("RecordingDuration"), 10) : null;
    const recordingStatus = hook.get("RecordingStatus");
    // DialVerb | Conference | RecordVerb | StartCallRecordingAPI … (absent on older callbacks)
    const source = hook.get("RecordingSource");

    if (!callSid || !recordingSid) return NextResponse.json({ ok: true });
    if (recordingStatus && recordingStatus !== "completed") return NextResponse.json({ ok: true });

    const supabase = createSupabaseAdminClient();
    const { data: call } = await supabase
      .from("calls")
      .select("id, answered_at, transcription_text, voicemail_transcription")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (!call) return NextResponse.json({ ok: true });

    const isVoicemail = source ? source === "RecordVerb" : !call.answered_at;
    const mp3 = `${recordingUrl}.mp3`;
    const now = new Date().toISOString();

    if (isVoicemail) {
      await supabase.from("calls").update({ voicemail_sid: recordingSid, voicemail_url: mp3, updated_at: now }).eq("id", call.id);
    } else {
      await supabase
        .from("calls")
        .update({
          recording_sid: recordingSid,
          recording_url: mp3,
          recording_duration: recordingDuration,
          // A Dial / Conference recording only exists if someone answered.
          ...(call.answered_at ? {} : { answered_at: hook.get("RecordingStartTime") ? new Date(hook.get("RecordingStartTime")).toISOString() : now }),
          updated_at: now,
        })
        .eq("id", call.id);
    }

    const settings = await getCommunicationSettings();
    const already = isVoicemail ? call.voicemail_transcription : call.transcription_text;
    if (settings.autoTranscribe && !already && (recordingDuration ?? 1) > 0) {
      after(() => autoTranscribe(call.id, mp3, isVoicemail));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Recording webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function autoTranscribe(callId: string, url: string, voicemail: boolean) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("calls").update({ transcription_status: "pending", updated_at: new Date().toISOString() }).eq("id", callId);
  // Twilio can take a moment before the media URL serves the file.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await transcribeRecording(url);
      await supabase
        .from("calls")
        .update({ [voicemail ? "voicemail_transcription" : "transcription_text"]: text, transcription_status: "completed", updated_at: new Date().toISOString() })
        .eq("id", callId);
      return;
    } catch (error) {
      if (attempt === 2) {
        console.error("[auto-transcribe] failed", callId, error);
        await supabase.from("calls").update({ transcription_status: "failed", updated_at: new Date().toISOString() }).eq("id", callId);
        return;
      }
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  }
}
