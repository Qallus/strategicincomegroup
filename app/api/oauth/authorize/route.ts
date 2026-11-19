// The consent decision from /oauth/authorize (a same-origin form POST).
// Cross-site POSTs are refused (Origin / Sec-Fetch-Site), so another site
// can't make a signed-in person approve an app without seeing the page.
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { mcpAccessFor } from "@/lib/mcp/auth";
import { checkAuthorizeParams, issueCode, pickAuthorizeParams, redirectWith } from "@/lib/mcp/authorize";
import { baseUrl } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  try {
    const o = new URL(origin);
    const own = new URL(baseUrl(request));
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
    return o.host === own.host || o.host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });

  const form = await request.formData();
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const params = pickAuthorizeParams(raw);

  const check = await checkAuthorizeParams(params);
  if (!check.ok) {
    if (!check.redirectable) return NextResponse.json({ error: check.message }, { status: 400 });
    return NextResponse.redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.message, state: check.state }), 303);
  }
  const { req } = check;

  if (raw.decision !== "allow") {
    return NextResponse.redirect(redirectWith(req.redirectUri, { error: "access_denied", error_description: "The person declined.", state: req.state }), 303);
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    const back = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>)}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(back)}`, baseUrl(request)), 303);
  }
  const access = mcpAccessFor(profile);
  if (!access.allowed) {
    return NextResponse.redirect(redirectWith(req.redirectUri, { error: "access_denied", error_description: access.reason, state: req.state }), 303);
  }

  try {
    const code = await issueCode(req, profile.id);
    return NextResponse.redirect(redirectWith(req.redirectUri, { code, state: req.state, iss: baseUrl(request) }), 303);
  } catch (e) {
    console.error("[oauth] authorize failed", e);
    return NextResponse.redirect(redirectWith(req.redirectUri, { error: "server_error", state: req.state }), 303);
  }
}
