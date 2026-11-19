import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing route for the links in the Supabase auth emails (supabase/email-templates).
// The email carries a one-time token hash; verifying it here, on the server, signs the
// person in with cookies — so links work in any browser, unlike the default PKCE links
// which only work in the browser that requested them.
//
//   /auth/confirm?token_hash=…&type=email|signup|invite|magiclink|email_change|recovery[&next=/path]

const TYPES = new Set<EmailOtpType>(["email", "signup", "invite", "magiclink", "email_change", "recovery"]);

/** Where each email lands after a successful check, unless a safe `next` is given. */
const DEFAULT_NEXT: Record<string, string> = {
  email: "/dashboard",
  signup: "/login?message=Your email is confirmed. Sign in to continue.",
  magiclink: "/dashboard",
  invite: "/reset-password?welcome=1", // signed in → choose a password
  recovery: "/reset-password",
  email_change: "/dashboard/profile",
};

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = (await supabase?.auth.verifyOtp({ type, token_hash: tokenHash })) ?? { error: new Error("Auth unavailable") };
    if (!error) {
      const next = safeNext(url.searchParams.get("next")) ?? DEFAULT_NEXT[type] ?? "/dashboard";
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const message = "That link is invalid or has expired. Request a new one and try again.";
  return NextResponse.redirect(new URL(`/login?message=${encodeURIComponent(message)}`, origin));
}
