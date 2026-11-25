import { getAIProvider } from "@/lib/ai/providers";
import { getTwilioConfig } from "@/lib/twilio/client";

/**
 * Downloads a Twilio recording (.mp3) and transcribes it with OpenAI.
 * Twilio recording media requires HTTP basic auth with the account credentials.
 */
export async function transcribeRecording(recordingUrl: string): Promise<string> {
  const openai = await getAIProvider("openai");
  const apiKey = openai.apiKey;
  if (!apiKey) throw new Error("OpenAI API key is not configured (Dashboard → Credentials → AI models, or OPENAI_API_KEY).");
  const { accountSid: TWILIO_ACCOUNT_SID, authToken: TWILIO_AUTH_TOKEN } = await getTwilioConfig();

  // Twilio media URLs require basic auth; public/S3 URLs do not but the header is harmless.
  const isTwilio = recordingUrl.includes("api.twilio.com") || recordingUrl.includes("twiliocdn");
  const headers: Record<string, string> = {};
  if (isTwilio && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    headers.Authorization = `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`;
  }

  const audioRes = await fetch(recordingUrl, { headers });
  if (!audioRes.ok) {
    throw new Error(`Failed to fetch recording (${audioRes.status}).`);
  }
  const audioBuffer = await audioRes.arrayBuffer();
  if (audioBuffer.byteLength === 0) throw new Error("Recording is empty.");

  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "recording.mp3");
  form.append("model", openai.transcribeModel ?? "whisper-1");
  form.append("response_format", "text");

  const res = await fetch(`${openai.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI transcription failed (${res.status}). ${detail}`.trim());
  }

  // response_format=text returns the transcript as plain text.
  const text = (await res.text()).trim();
  if (!text) throw new Error("Transcription returned no text.");
  return text;
}
