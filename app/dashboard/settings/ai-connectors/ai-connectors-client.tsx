"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Link2, Loader2, Plug, RefreshCw, ShieldCheck, Trash2, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiTokenRow, AuditRow, ConnectedClient } from "@/lib/mcp/connections";

export type ToolSummary = { name: string; title: string; risk: "read" | "write" | "high"; area: string };

type Props = {
  mcpUrl: string;
  actionToken: string;
  initialClients: ConnectedClient[];
  initialTokens: ApiTokenRow[];
  initialAudit: AuditRow[];
  isAdmin: boolean;
  areas: string[];
  tools: ToolSummary[];
};

const ACCESS_LEVELS = {
  read: { label: "Read only", tiers: ["read"] },
  write: { label: "Read + write (no publish/delete)", tiers: ["read", "write"] },
  full: { label: "Full (high-risk actions need sig_confirm)", tiers: ["read", "write", "high"] },
} as const;
type AccessLevel = keyof typeof ACCESS_LEVELS;

const KIND_LABEL: Record<string, string> = {
  claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", grok: "Grok", local: "Local app", other: "Other", api_token: "API token",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (risk === "high") return <Badge variant="destructive">high</Badge>;
  if (risk === "write") return <Badge variant="secondary">write</Badge>;
  return <Badge variant="outline">read</Badge>;
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 pr-20 text-xs leading-relaxed text-foreground">
        <code>{children}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton value={children} />
      </div>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

export function AiConnectorsClient({ mcpUrl, actionToken, initialClients, initialTokens, initialAudit, isAdmin, areas, tools }: Props) {
  const [clients, setClients] = useState(initialClients);
  const [tokens, setTokens] = useState(initialTokens);
  const [audit, setAudit] = useState(initialAudit);
  const [scope, setScope] = useState<"me" | "team">("me");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [level, setLevel] = useState<AccessLevel>("read");
  const [expiry, setExpiry] = useState("90");
  const [newToken, setNewToken] = useState<string | null>(null);

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-sig-action-token": actionToken }), [actionToken]);

  const refresh = useCallback(
    async (nextScope = scope) => {
      setBusy("refresh");
      setError(null);
      try {
        const res = await fetch(`/api/admin/ai-connectors${nextScope === "team" ? "?scope=team" : ""}`, { headers, cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't refresh.");
        setClients(json.clients);
        setTokens(json.tokens);
        setAudit(json.audit);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't refresh.");
      } finally {
        setBusy(null);
      }
    },
    [headers, scope],
  );

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-connectors/tokens", {
        method: "POST",
        headers,
        body: JSON.stringify({ actionToken, name, tiers: ACCESS_LEVELS[level].tiers, expiresInDays: expiry === "never" ? null : Number(expiry) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't create the token.");
      setNewToken(json.token);
      setTokens((list) => [json.row, ...list]);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the token.");
    } finally {
      setBusy(null);
    }
  }

  async function revokeToken(id: string) {
    if (!window.confirm("Revoke this token? Anything using it stops working immediately.")) return;
    setBusy(`token:${id}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai-connectors/tokens/${id}`, { method: "DELETE", headers, body: JSON.stringify({ actionToken }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't revoke the token.");
      setTokens((list) => list.map((t) => (t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't revoke the token.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(clientId: string, label: string) {
    if (!window.confirm(`Disconnect ${label}? It will need to sign in again to use SIG.`)) return;
    setBusy(`client:${clientId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai-connectors/clients/${encodeURIComponent(clientId)}`, { method: "DELETE", headers, body: JSON.stringify({ actionToken }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't disconnect.");
      setClients((list) => list.filter((c) => c.client_id !== clientId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't disconnect.");
    } finally {
      setBusy(null);
    }
  }

  const activeTokens = tokens.filter((t) => !t.revoked_at);
  const counts = { read: 0, write: 0, high: 0 } as Record<string, number>;
  for (const t of tools) counts[t.risk] += 1;

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      {/* Server URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" aria-hidden /> MCP server URL
          </CardTitle>
          <CardDescription>Paste this into your AI app as a custom connector / remote MCP server. Sign-in uses your SIG account (OAuth 2.1).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border bg-muted/60 px-3 py-2 font-mono text-sm">{mcpUrl}</code>
            <CopyButton value={mcpUrl} label="Copy URL" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{tools.length} tools for your role:</span>
            <Badge variant="outline">{counts.read} read</Badge>
            <Badge variant="secondary">{counts.write} write</Badge>
            <Badge variant="destructive">{counts.high} high-risk</Badge>
            {areas.length ? <span>· Areas: {areas.join(", ")}</span> : null}
          </div>
        </CardContent>
      </Card>

      {/* Setup per client */}
      <Card>
        <CardHeader>
          <CardTitle>Set up your AI app</CardTitle>
          <CardDescription>Each person connects their own app; it acts with that person&apos;s SIG role.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude">
            <TabsList>
              <TabsTrigger value="claude">Claude</TabsTrigger>
              <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
              <TabsTrigger value="gemini">Gemini CLI</TabsTrigger>
              <TabsTrigger value="grok">Grok / xAI</TabsTrigger>
            </TabsList>
            <TabsContent value="claude" className="space-y-3 pt-3">
              <Steps
                items={[
                  <>In Claude (claude.ai or the desktop app) open <strong className="text-foreground">Settings → Connectors → Add custom connector</strong>. On Team/Enterprise plans an owner adds it under Organization settings first.</>,
                  <>Name it <strong className="text-foreground">Strategic Income Group</strong> and paste the server URL above. Leave the OAuth client fields empty.</>,
                  <>Click <strong className="text-foreground">Connect</strong>, sign in to SIG if asked, and choose <strong className="text-foreground">Allow access</strong>.</>,
                  <>In a chat, enable the connector from the tools menu. Try: &ldquo;What upcoming SIG events have open seats?&rdquo;</>,
                ]}
              />
              <p className="text-xs text-muted-foreground">Claude Code: <code className="font-mono">claude mcp add --transport http sig {mcpUrl}</code>, then run <code className="font-mono">/mcp</code> to sign in.</p>
            </TabsContent>
            <TabsContent value="chatgpt" className="space-y-3 pt-3">
              <Steps
                items={[
                  <>In ChatGPT open <strong className="text-foreground">Settings → Apps &amp; Connectors → Advanced settings</strong> and turn on <strong className="text-foreground">Developer mode</strong> (Business/Enterprise: an admin must allow custom connectors).</>,
                  <>Choose <strong className="text-foreground">Create</strong> (custom connector), name it Strategic Income Group, paste the server URL and pick <strong className="text-foreground">OAuth</strong> authentication.</>,
                  <>ChatGPT registers itself and opens SIG&apos;s sign-in; choose <strong className="text-foreground">Allow access</strong>.</>,
                  <>In a chat, pick the connector from the + menu (Developer mode). ChatGPT asks before running tools that change data.</>,
                ]}
              />
            </TabsContent>
            <TabsContent value="gemini" className="space-y-3 pt-3">
              <Steps
                items={[
                  <>Add this to <code className="font-mono">~/.gemini/settings.json</code> (or the project&apos;s <code className="font-mono">.gemini/settings.json</code>):</>,
                ]}
              />
              <CodeBlock>{JSON.stringify({ mcpServers: { sig: { httpUrl: mcpUrl, oauth: { enabled: true } } } }, null, 2)}</CodeBlock>
              <Steps
                items={[
                  <>Start <code className="font-mono">gemini</code> and run <code className="font-mono">/mcp auth sig</code>. A browser opens SIG&apos;s sign-in; choose Allow access.</>,
                  <>Check with <code className="font-mono">/mcp list</code>. Headless/servers: use an API token instead, as a header: <code className="font-mono">&quot;headers&quot;: {"{"} &quot;Authorization&quot;: &quot;Bearer sig_pat_…&quot; {"}"}</code>.</>,
                ]}
              />
            </TabsContent>
            <TabsContent value="grok" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                The xAI API calls remote MCP servers with a fixed header, so create an API token below (choose the access level you want) and pass it as the authorization:
              </p>
              <CodeBlock>{`curl https://api.x.ai/v1/responses \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "grok-4",
    "input": "List next week\\u0027s SIG bookings",
    "tools": [{
      "type": "mcp",
      "server_label": "sig",
      "server_url": "${mcpUrl}",
      "authorization": "sig_pat_YOUR_TOKEN"
    }]
  }'`}</CodeBlock>
              <p className="text-xs text-muted-foreground">
                If your Grok app offers custom connectors with OAuth, use the server URL above instead — sign-in works like Claude&apos;s. Any other MCP client that can send a header can use <code className="font-mono">Authorization: Bearer sig_pat_…</code>.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Connected apps */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" aria-hidden /> Connected apps
              </CardTitle>
              <CardDescription>AI apps you&apos;ve allowed through sign-in.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refresh()} disabled={busy === "refresh"} aria-label="Refresh">
              {busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {clients.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.client_id}>
                      <TableCell>
                        <p className="font-medium">{c.client_name}</p>
                        <p className="text-xs text-muted-foreground">{KIND_LABEL[c.client_kind] ?? c.client_kind} · since {fmt(c.first_connected_at)}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(c.last_used_at)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => disconnect(c.client_id, c.client_name)} disabled={busy === `client:${c.client_id}`}>
                          <Unplug className="h-3.5 w-3.5" /> Disconnect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No apps connected yet. Follow a setup guide above.</p>
            )}
          </CardContent>
        </Card>

        {/* API tokens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden /> API tokens
            </CardTitle>
            <CardDescription>For clients that can&apos;t sign in with OAuth (xAI API, scripts). Tokens act as you; keep them secret.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {newToken ? (
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Copy your token now — it won&apos;t be shown again.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all rounded-md border bg-background px-3 py-2 font-mono text-xs">{newToken}</code>
                  <CopyButton value={newToken} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setNewToken(null)}>
                  I&apos;ve saved it
                </Button>
              </div>
            ) : null}

            <form onSubmit={createToken} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="token-name">Name</Label>
                <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grok API" maxLength={80} required />
              </div>
              <div className="space-y-1.5">
                <Label>Access</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as AccessLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ACCESS_LEVELS) as AccessLevel[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {ACCESS_LEVELS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expires</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">In 30 days</SelectItem>
                    <SelectItem value="90">In 90 days</SelectItem>
                    <SelectItem value="365">In 1 year</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy === "create" || !name.trim()}>
                  {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Create token
                </Button>
              </div>
            </form>

            {tokens.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((t) => (
                    <TableRow key={t.id} className={t.revoked_at ? "opacity-60" : undefined}>
                      <TableCell>
                        <p className="font-medium">{t.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{t.token_prefix}…</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.allowed_tiers.map((tier) => (
                            <RiskBadge key={tier} risk={tier} />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{t.revoked_at ? `Revoked ${fmt(t.revoked_at)}` : t.expires_at ? `Expires ${fmt(t.expires_at)}` : "No expiry"}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(t.last_used_at)}</TableCell>
                      <TableCell>
                        {!t.revoked_at ? (
                          <Button variant="outline" size="sm" onClick={() => revokeToken(t.id)} disabled={busy === `token:${t.id}`}>
                            <Trash2 className="h-3.5 w-3.5" /> Revoke
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <p className="text-xs text-muted-foreground">{activeTokens.length} active of 10 allowed.</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Recent AI activity</CardTitle>
            <CardDescription>Every tool call from any AI app, newest first.</CardDescription>
          </div>
          {isAdmin ? (
            <Select
              value={scope}
              onValueChange={(v) => {
                const next = v as "me" | "team";
                setScope(next);
                void refresh(next);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Mine</SelectItem>
                <SelectItem value="team">Whole team</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </CardHeader>
        <CardContent>
          {audit.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Tool</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>App</TableHead>
                    {scope === "team" ? <TableHead>Who</TableHead> : null}
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmt(row.created_at)}</TableCell>
                      <TableCell>
                        <p className="font-mono text-xs">{row.tool}</p>
                        {row.summary ? <p className="text-xs text-muted-foreground">{row.summary}</p> : null}
                      </TableCell>
                      <TableCell>
                        <RiskBadge risk={row.risk} />
                      </TableCell>
                      <TableCell className="text-sm">{row.client_name ?? KIND_LABEL[row.client_kind ?? ""] ?? "—"}</TableCell>
                      {scope === "team" ? <TableCell className="text-sm">{row.email ?? "—"}</TableCell> : null}
                      <TableCell className="text-sm">
                        {row.success ? (
                          <span className="text-foreground">OK</span>
                        ) : (
                          <span className="text-destructive" title={row.error ?? undefined}>
                            Failed{row.error ? `: ${row.error.slice(0, 80)}` : ""}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No AI activity yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Tools available to you</CardTitle>
          <CardDescription>High-risk tools return a preview and only run after you confirm (sig_confirm). Deletes go to a restorable trash.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((t) => (
              <div key={t.name} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-sm">
                <span className="truncate font-mono text-xs" title={t.title}>
                  {t.name}
                </span>
                <RiskBadge risk={t.risk} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
