import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { knownBot } from "@/lib/analytics/bots";

// Pages worth counting when an AI crawler / search bot fetches them. Everything
// else (API, dashboard, framework assets, files) is skipped with one regex test.
const BOT_SKIP = /^\/(api|_next|dashboard|website-preview|auth|oauth|login|accept-invite|reset-password|two-factor|access-restricted)(\/|$)/;
const FILE_EXT = /\.[a-z0-9]{2,5}$/i;
const BOT_FILES = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt"]);

/**
 * Count AI crawler / search bot page hits (analytics_bot_hits). Fire-and-forget via
 * waitUntil, so it never delays or breaks the response. No visitor data is involved.
 */
function logBotHit(request: NextRequest, event: NextFetchEvent) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return;
    const ua = request.headers.get("user-agent");
    if (!ua) return;
    const path = request.nextUrl.pathname;
    if (BOT_SKIP.test(path) || (FILE_EXT.test(path) && !BOT_FILES.has(path))) return;
    if (!knownBot(ua)) return;
    const origin = process.env.ANALYTICS_INTERNAL_ORIGIN || request.nextUrl.origin;
    event.waitUntil(
      fetch(`${origin}/api/t/bot`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": ua, "x-sig-bot-ua": ua },
        body: JSON.stringify({ path }),
      })
        .then(() => undefined)
        .catch(() => undefined),
    );
  } catch {
    /* analytics must never affect the request */
  }
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  logBotHit(request, event);

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror onto the inbound request (so downstream Server Components read the
        // fresh token) and onto the response (so the browser receives every chunk).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // The ONLY job of this middleware is to keep the session token fresh.
  //
  // getSession() reads the session from the cookie locally and, when the access
  // token has expired, refreshes it and persists the rotated cookies onto the
  // response. Unlike getUser(), it does NOT make a live validation call to the
  // Supabase Auth server — so a transient 401/network blip during rapid link
  // clicks and prefetch bursts can never wipe a valid session and log the user out.
  //
  // We deliberately do NOT redirect or clear cookies here. Access control lives in
  // the dashboard layout (getCurrentProfile), which reads the (now fresh) session
  // locally and is not subject to per-request network failures.
  await supabase.auth.getSession();

  // IMPORTANT: return supabaseResponse unchanged so any refreshed Set-Cookie headers
  // reach the browser. Returning a different response object drops those cookies and
  // silently logs the user out.
  return supabaseResponse;
}

export const config = {
  matcher: [
    // `.well-known/workflow` is excluded deliberately, not for performance. The
    // eve/Workflow worker delivers orchestration and step invocations to
    // /.well-known/workflow/v1/flow over loopback, and @workflow/world-postgres
    // is explicit: "Do not gate these paths in framework middleware... a handler
    // that consumes the internal request body breaks execution." Running this
    // middleware over them would do exactly that. That route is protected at the
    // ingress instead, where blocking external traffic costs nothing because
    // loopback delivery never traverses it.
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|\\.well-known/workflow|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
