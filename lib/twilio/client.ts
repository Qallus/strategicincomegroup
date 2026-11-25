import twilio from "twilio";
import { createHash } from "node:crypto";
import { getProviderConfig } from "@/lib/credentials/server";

// Twilio settings come from SIG Credentials (Dashboard → Credentials → Voice & SMS): the
// dashboard value first, then the TWILIO_* Coolify env vars. Read per call (the store
// caches for 60 seconds), so a new key takes effect without a redeploy.

export const DEFAULT_TWILIO_PHONE_NUMBER = "+14804393335";

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  apiKey: string;
  apiSecret: string;
  twimlAppSid: string;
  /**
   * Messaging Service that carries the approved A2P 10DLC campaign.
   *
   * Sending with `messagingServiceSid` instead of a bare `from` number is what routes traffic
   * through the registered campaign. Sending from the raw number only works when that number is
   * attached to the campaign's service, otherwise US carriers reject every message with
   * error 30034 ("message from an unregistered number") and it silently never arrives.
   */
  messagingServiceSid: string;
  phoneNumber: string;
  forwardingNumber: string;
};

export async function getTwilioConfig(): Promise<TwilioConfig> {
  const c = await getProviderConfig("twilio");
  return {
    accountSid: c.account_sid ?? "",
    authToken: c.auth_token ?? "",
    apiKey: c.api_key ?? "",
    apiSecret: c.api_secret ?? "",
    twimlAppSid: c.twiml_app_sid ?? "",
    messagingServiceSid: c.messaging_service_sid ?? "",
    phoneNumber: c.phone_number || DEFAULT_TWILIO_PHONE_NUMBER,
    forwardingNumber: c.forwarding_number ?? "",
  };
}

export async function hasTwilioConfig(): Promise<boolean> {
  const c = await getTwilioConfig();
  return Boolean(c.accountSid && c.authToken);
}

// The client is cached per SID + token, so saving a new token builds a new client.
let _client: { key: string; client: ReturnType<typeof twilio> } | null = null;

export async function getTwilioClient() {
  const { accountSid, authToken } = await getTwilioConfig();
  if (!accountSid || !authToken) throw new Error("Twilio account SID and auth token are required (Dashboard → Credentials → Voice & SMS).");
  const key = createHash("sha256").update(`${accountSid}:${authToken}`).digest("hex");
  if (_client?.key === key) return _client.client;
  const client = twilio(accountSid, authToken);
  _client = { key, client };
  return client;
}

export async function validateTwilioRequest(url: string, params: Record<string, string>, signature: string) {
  const { validateRequest } = twilio;
  const { authToken } = await getTwilioConfig();
  return validateRequest(authToken, signature, url, params);
}

/**
 * Fetches the finalized price of a call from Twilio. Twilio reports price as a
 * negative string (a charge) and may not populate it until shortly after the
 * call completes. Returns the positive magnitude, or null if not yet available.
 */
export async function fetchCallPrice(callSid: string): Promise<{ price: number; priceUnit: string | null } | null> {
  if (!callSid) return null;
  try {
    const call = await (await getTwilioClient()).calls(callSid).fetch();
    if (call.price == null || call.price === "") return null;
    const value = Math.abs(parseFloat(String(call.price)));
    if (Number.isNaN(value)) return null;
    return { price: value, priceUnit: call.priceUnit ?? null };
  } catch (error) {
    console.error("fetchCallPrice error:", error);
    return null;
  }
}
