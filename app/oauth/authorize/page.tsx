// OAuth consent for the SIG MCP server: "Claude wants to connect to SIG as you".
// Signed-out visitors go to /login?next=… and come straight back here.
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { AuthMessage, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth/server";
import { ROLE_LABELS } from "@/lib/rbac/roles";
import { mcpAccessFor } from "@/lib/mcp/auth";
import { checkAuthorizeParams, pickAuthorizeParams, redirectWith } from "@/lib/mcp/authorize";
import { areasFor, type Area } from "@/lib/mcp/policy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect an AI app — Strategic Income Group", robots: { index: false, follow: false } };

const AREA_TEXT: Record<Area, string> = {
  contacts: "Search, add and update contacts and leads",
  forms: "Read and triage website form submissions",
  bookings: "Manage planner booking pages, availability and appointments",
  events: "Manage events, registrations and check-ins",
  blog: "Draft and edit blog posts",
  website: "Edit website page drafts in the Frontend Editor",
  admin: "See the team's AI activity log",
};

const KIND_LABEL: Record<string, string> = {
  claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", grok: "Grok", local: "a local app", other: "an AI app",
};

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = pickAuthorizeParams(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const check = await checkAuthorizeParams(params);

  if (!check.ok) {
    if (check.redirectable) redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.message, state: check.state }));
    return (
      <AuthShell eyebrow="AI connectors" title="Can't connect" description="This connection request isn't valid.">
        <AuthMessage tone="error">{check.message}</AuthMessage>
      </AuthShell>
    );
  }
  const { req } = check;

  const profile = await getCurrentProfile();
  if (!profile) {
    const back = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>)}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const access = mcpAccessFor(profile);
  if (!access.allowed) {
    return (
      <AuthShell eyebrow="AI connectors" title="Access isn't available" description={`Signed in as ${profile.email}.`}>
        <AuthMessage tone="error">{access.reason}</AuthMessage>
      </AuthShell>
    );
  }

  const redirectHost = (() => {
    try {
      const u = new URL(req.redirectUri);
      return u.hostname === "localhost" || u.hostname === "127.0.0.1" ? `${u.hostname}:${u.port || "80"} (this computer)` : u.hostname;
    } catch {
      return req.redirectUri;
    }
  })();
  const areas = areasFor(profile.role);
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
  const hidden = { ...params, client_id: req.clientId, redirect_uri: req.redirectUri };
  const kind = KIND_LABEL[req.clientKind] ?? KIND_LABEL.other;

  return (
    <AuthShell
      eyebrow="Connect an AI app"
      title={`Allow ${req.clientName}?`}
      description={`${req.clientName} (${kind}) wants to work in Strategic Income Group as you.`}
      footer={<>Every request is logged. Disconnect any time in Admin Settings → AI Connectors.</>}
    >
      <div className="space-y-5">
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p>
            Signed in as <span className="font-medium text-foreground">{displayName}</span>
            <span className="text-muted-foreground"> · {ROLE_LABELS[profile.role]}</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            Sends you back to <span className="font-mono text-xs text-foreground">{redirectHost}</span>
          </p>
        </div>

        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-gold" aria-hidden /> It will be able to
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {(areas.length ? areas.map((a) => AREA_TEXT[a]) : ["Look up who you are (your role has no data areas yet)"]).map((line) => (
              <li key={line} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            Only what your role can already do. Publishing, deleting and other high-risk changes always show you a preview first and
            need your clear yes. Deleted records can be restored.
          </span>
        </p>

        <form method="post" action="/api/oauth/authorize" className="flex flex-col gap-2 sm:flex-row">
          {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={String(v)} /> : null))}
          <Button type="submit" name="decision" value="allow" className="h-11 flex-1">
            Allow access
          </Button>
          <Button type="submit" name="decision" value="deny" variant="outline" className="h-11">
            Cancel
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
