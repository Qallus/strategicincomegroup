// Admin Settings → AI Connectors: connect Claude, ChatGPT, Gemini CLI and
// Grok/xAI to SIG through the MCP server at /api/mcp, manage the apps and
// personal API tokens you've connected, and see recent AI activity.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminActionToken } from "@/lib/auth/action-token";
import { getCurrentProfile } from "@/lib/auth/server";
import { mcpAccessFor } from "@/lib/mcp/auth";
import { listApiTokens, listConnectedClients, recentAudit, type ApiTokenRow, type AuditRow, type ConnectedClient } from "@/lib/mcp/connections";
import { areasFor, canUseArea } from "@/lib/mcp/policy";
import { allTools } from "@/lib/mcp/tools";
import { AiConnectorsClient, type ToolSummary } from "./ai-connectors-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Connectors" };

async function serverUrl(): Promise<string> {
  const configured = process.env.MCP_PUBLIC_URL?.trim();
  if (configured) return `${configured.replace(/\/+$/, "")}/api/mcp`;
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}/api/mcp`;
}

export default async function AiConnectorsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard/settings/ai-connectors");
  const access = mcpAccessFor(profile);
  const mcpUrl = await serverUrl();

  let clients: ConnectedClient[] = [];
  let tokens: ApiTokenRow[] = [];
  let audit: AuditRow[] = [];
  let loadError: string | null = null;
  if (access.allowed) {
    try {
      [clients, tokens, audit] = await Promise.all([
        listConnectedClients(profile.id),
        listApiTokens(profile.id),
        recentAudit({ profileId: profile.id, limit: 40 }),
      ]);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Couldn't load AI connector data.";
    }
  }

  const tools: ToolSummary[] = allTools()
    .filter((t) => !t.area || canUseArea(profile.role, t.area))
    .map((t) => ({ name: t.name, title: t.title, risk: t.risk, area: t.area ?? "meta" }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin Settings"
        title="AI Connectors"
        description="Connect Claude, ChatGPT, Gemini or Grok to Strategic Income Group. The AI works as you — it can only do what your role can do, high-risk changes always need your confirmation, and every call is logged."
      />

      {!access.allowed ? (
        <Card>
          <CardHeader>
            <CardTitle>AI connectors aren&apos;t available for your account</CardTitle>
            <CardDescription>{access.reason}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {loadError ? (
            <Card className="border-destructive/40">
              <CardContent className="p-4 text-sm text-destructive">
                {loadError} If this is a new environment, the <code className="font-mono">202611190110_mcp_core.sql</code> migration may not be applied yet.
              </CardContent>
            </Card>
          ) : null}
          <AiConnectorsClient
            mcpUrl={mcpUrl}
            actionToken={createAdminActionToken(profile)}
            initialClients={clients}
            initialTokens={tokens}
            initialAudit={audit}
            isAdmin={canUseArea(profile.role, "admin")}
            areas={areasFor(profile.role)}
            tools={tools}
          />
        </>
      )}
    </div>
  );
}
