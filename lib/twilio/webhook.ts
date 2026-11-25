import { NextResponse } from "next/server";
import { validateTwilioRequest } from "@/lib/twilio/client";

/**
 * Twilio webhook intake: reads the form body and verifies the X-Twilio-Signature header.
 *
 * Twilio signs the exact public URL it called (scheme + host + path + query) plus the POST
 * params. Behind Coolify's proxy the URL Next.js sees is the internal one
 * (http://0.0.0.0:3000/…), so we rebuild the public URL and accept the request if ANY of
 * these candidates validates:
 *   1. NEXT_PUBLIC_APP_URL + path + query   (what our TwiML / status callbacks point at)
 *   2. x-forwarded-proto + x-forwarded-host (or host) + path + query
 *   3. request.url as received
 *
 * Debug bypass: set TWILIO_SKIP_SIGNATURE=1 in Coolify to accept unsigned requests (logs a
 * warning on every request). Remove it once the console URLs are confirmed — without the
 * check anyone can post fake calls/texts to these endpoints.
 */

export type TwilioWebhook = {
  params: Record<string, string>;
  url: URL;
  get: (key: string) => string;
};

export type TwilioWebhookResult =
  | { ok: true; hook: TwilioWebhook }
  | { ok: false; response: NextResponse };

function candidateUrls(request: Request): string[] {
  const received = new URL(request.url);
  const pathAndQuery = `${received.pathname}${received.search}`;
  const out = new Set<string>();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (appUrl) out.add(`${appUrl}${pathAndQuery}`);

  const fwdHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const fwdProto = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim() || "https";
  if (fwdHost) {
    out.add(`${fwdProto}://${fwdHost}${pathAndQuery}`);
    // Some proxies strip the default port inconsistently; try both forms.
    out.add(`${fwdProto}://${fwdHost.replace(/:(443|80)$/, "")}${pathAndQuery}`);
  }

  out.add(request.url);
  return [...out];
}

export function twilioSignatureBypassed() {
  return process.env.TWILIO_SKIP_SIGNATURE === "1" || process.env.TWILIO_SKIP_SIGNATURE === "true";
}

export async function readTwilioWebhook(
  request: Request,
  { reject = "json" }: { reject?: "json" | "twiml" } = {},
): Promise<TwilioWebhookResult> {
  const params: Record<string, string> = {};
  try {
    const form = await request.formData();
    form.forEach((value, key) => {
      if (typeof value === "string") params[key] = value;
    });
  } catch {
    /* empty or non-form body — signature check below still decides */
  }

  const url = new URL(request.url);
  const hook: TwilioWebhook = { params, url, get: (key) => params[key] ?? "" };

  if (twilioSignatureBypassed()) {
    console.warn(`[twilio] signature check SKIPPED (TWILIO_SKIP_SIGNATURE) for ${url.pathname}`);
    return { ok: true, hook };
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (signature) {
    for (const candidate of candidateUrls(request)) {
      try {
        if (await validateTwilioRequest(candidate, params, signature)) return { ok: true, hook };
      } catch {
        /* auth token missing — falls through to reject */
      }
    }
  }

  console.warn(
    `[twilio] rejected webhook ${url.pathname}: ${signature ? "signature did not match" : "no X-Twilio-Signature"}. ` +
      `Tried: ${candidateUrls(request).join(" | ")}. Check NEXT_PUBLIC_APP_URL matches the URL in the Twilio console ` +
      `(or set TWILIO_SKIP_SIGNATURE=1 temporarily).`,
  );

  const response =
    reject === "twiml"
      ? new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`, {
          status: 403,
          headers: { "Content-Type": "text/xml" },
        })
      : NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  return { ok: false, response };
}

export function twimlResponse(xml: string, status = 200) {
  return new NextResponse(xml, { status, headers: { "Content-Type": "text/xml" } });
}

export const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

/** Public base URL for TwiML callbacks, no trailing slash. */
export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
}

export function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
}
