import twilio from "twilio";
import { getTwilioConfig } from "@/lib/twilio/client";

export async function generateVoiceAccessToken(profileId: string, identity: string): Promise<string> {
  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;
  const cfg = await getTwilioConfig();

  const key = cfg.apiKey || cfg.accountSid;
  const secret = cfg.apiSecret || cfg.authToken || "";

  const token = new AccessToken(cfg.accountSid, key, secret, {
    identity,
    ttl: 3600,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: cfg.twimlAppSid || undefined,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}

export async function buildInboundCallTwiml(callerNumber: string): Promise<string> {
  const { phoneNumber: TWILIO_PHONE_NUMBER } = await getTwilioConfig();
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  response.say({ voice: "Polly.Joanna" }, "Thank you for calling. Please hold while we connect you.");

  const dial = response.dial({
    callerId: TWILIO_PHONE_NUMBER,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
    timeout: 20,
  });

  dial.client("sig-agent");

  response.say({ voice: "Polly.Joanna" }, "Sorry, we missed your call. Please leave a message after the tone and we will get back to you.");
  response.record({
    maxLength: 120,
    transcribe: true,
    transcribeCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/transcription`,
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/voice-status`,
  });
  response.say({ voice: "Polly.Joanna" }, "Thank you. Goodbye.");

  return response.toString();
}

export async function buildOutboundCallTwiml(to: string): Promise<string> {
  const { phoneNumber: TWILIO_PHONE_NUMBER } = await getTwilioConfig();
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const dial = response.dial({
    callerId: TWILIO_PHONE_NUMBER,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
  });

  dial.number(to);
  return response.toString();
}
