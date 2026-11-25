"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, History, Info, KeyRound, Loader2, Lock, Pencil, PlugZap, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { StatusPill } from "@/components/analytics/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldSelect } from "@/components/ui/field-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CatalogField, CatalogProvider, CredentialsOverview, FieldStatus, HistoryEntry, ProviderStatus, TabId } from "@/lib/credentials/types";

type Props = { initialOverview: CredentialsOverview; initialTab: string | null; actionToken: string };
type Notice = { kind: "success" | "error"; text: string } | null;

const keyOf = (p: CatalogProvider) => `${p.id}|${p.instance ?? "default"}`;

function fmt(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const ACTION_LABEL: Record<string, string> = {
  credential_updated: "Updated",
  credential_removed: "Removed",
  credential_tested: "Tested",
  credential_provider_added: "Provider added",
  credential_provider_removed: "Provider removed",
};

function ProviderPill({ provider, status }: { provider: CatalogProvider; status: ProviderStatus | undefined }) {
  if (!status) return <StatusPill status="needs_setup" label="Not set" />;
  if (provider.managedInCoolify) {
    const set = status.fields.filter((f) => f.source !== "missing").length;
    if (set === status.fields.length) return <StatusPill status="live" label="Set in Coolify" />;
    return <StatusPill status="needs_setup" label={set ? `${set} of ${status.fields.length} set in Coolify` : "Not set in Coolify"} />;
  }
  switch (status.state) {
    case "connected": return <StatusPill status="live" label="Connected" />;
    case "coolify": return <StatusPill status="waiting" label="Using Coolify value" />;
    case "incomplete": return <StatusPill status="needs_setup" label="Incomplete" />;
    case "failed": return <StatusPill status="error" label={status.fields.some((f) => f.undecryptable) ? "Can't decrypt" : "Test failed"} />;
    default: return <StatusPill status="needs_setup" label="Not set" />;
  }
}

function SourceBadge({ field, managed }: { field: FieldStatus; managed?: boolean }) {
  if (field.source === "dashboard") return <Badge variant="secondary" className="font-medium">Dashboard</Badge>;
  if (field.source === "coolify") return <Badge variant="outline" className="font-medium">{managed ? "Coolify" : "Coolify fallback"}</Badge>;
  return <Badge variant="outline" className="border-dashed font-medium text-muted-foreground">Not set</Badge>;
}

function FieldValue({ def, field, managed }: { def: CatalogField; field: FieldStatus; managed?: boolean }) {
  if (field.source === "missing") return <span className="text-muted-foreground">—</span>;
  if (field.undecryptable) return <span className="text-destructive">Can&apos;t decrypt — re-enter it</span>;
  if (def.secret) {
    if (managed) return <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3" aria-hidden /> Set</span>;
    return <span className="font-mono tracking-wide">{field.last4 ? `••••${field.last4}` : "••••••••"}</span>;
  }
  // Long URLs / keys stay on one line (full value in the tooltip) instead of wrapping into a tall column.
  return (
    <span className="block truncate font-mono text-xs" title={field.value ?? undefined}>
      {field.value}
    </span>
  );
}

export function CredentialsClient({ initialOverview, initialTab, actionToken }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [overview, setOverview] = useState<CredentialsOverview>(initialOverview);
  const validTab = (t: string | null): TabId => (overview.tabs.some((x) => x.id === t) ? (t as TabId) : overview.tabs[0].id);
  const [tab, setTab] = useState<TabId>(validTab(initialTab));
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [editing, setEditing] = useState<CatalogProvider | null>(null);
  const [removing, setRemoving] = useState<CatalogProvider | null>(null);
  const [historyFor, setHistoryFor] = useState<CatalogProvider | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [confirmMigrate, setConfirmMigrate] = useState(false);

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-sig-action-token": actionToken }), [actionToken]);

  const call = useCallback(
    async (url: string, method: string, body?: Record<string, unknown>) => {
      const res = await fetch(url, { method, headers, body: body ? JSON.stringify({ ...body, actionToken }) : undefined, cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      if (json.overview) setOverview(json.overview as CredentialsOverview);
      return json;
    },
    [headers, actionToken],
  );

  function changeTab(next: string) {
    const t = validTab(next);
    setTab(t);
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
  }

  const byTab = useMemo(() => {
    const map = new Map<TabId, CatalogProvider[]>();
    for (const p of overview.providers) map.set(p.tab, [...(map.get(p.tab) ?? []), p]);
    return map;
  }, [overview.providers]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return overview.providers.filter((p) =>
      [p.name, p.description, p.id, ...p.fields.flatMap((f) => [f.label, f.envVar ?? ""])].some((s) => s.toLowerCase().includes(q)),
    );
  }, [q, overview.providers]);

  async function runTest(p: CatalogProvider) {
    setBusy(`test:${keyOf(p)}`);
    setNotice(null);
    try {
      const json = await call("/api/admin/credentials/test", "POST", { provider: p.id, instance: p.instance ?? "default" });
      setNotice({ kind: json.ok ? "success" : "error", text: `${p.name}: ${json.message}` });
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Test failed." });
    } finally {
      setBusy(null);
    }
  }

  async function migrateSocial() {
    setBusy("migrate");
    setNotice(null);
    try {
      const json = await call("/api/admin/credentials/migrate-social", "POST", {});
      const failed = Array.isArray(json.failed) ? json.failed.length : 0;
      setNotice({
        kind: failed ? "error" : "success",
        text: failed
          ? `Moved ${json.fields} tokens from ${json.accounts} accounts; ${failed} account(s) failed and still hold plain-text tokens: ${json.failed.map((f: { error: string }) => f.error).join("; ")}`
          : `Encrypted ${json.fields} tokens from ${json.accounts} account(s) and cleared the plain-text copies.`,
      });
      setConfirmMigrate(false);
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Move failed." });
    } finally {
      setBusy(null);
    }
  }

  const renderCards = (list: CatalogProvider[], showTab = false) => (
    <div className="grid gap-4 xl:grid-cols-2">
      {list.map((p) => (
        <ProviderCard
          key={keyOf(p)}
          provider={p}
          status={overview.statuses[keyOf(p)]}
          tabLabel={showTab ? overview.tabs.find((t) => t.id === p.tab)?.label : undefined}
          testing={busy === `test:${keyOf(p)}`}
          onEdit={() => setEditing(p)}
          onTest={() => runTest(p)}
          onRemove={() => setRemoving(p)}
          onHistory={() => setHistoryFor(p)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search providers, fields or variables" className="pl-9" aria-label="Search credentials" />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Encrypted with AES-256-GCM · write-only · every change is logged
        </p>
      </div>

      {notice ? (
        <div
          role="status"
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
            notice.kind === "success" ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300" : "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
          )}
        >
          <span className="break-words">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {q ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{matches.length ? `${matches.length} match${matches.length === 1 ? "" : "es"} across all tabs` : "No providers match that search."}</p>
          {renderCards(matches, true)}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="w-full justify-start sm:w-auto">
            {overview.tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {overview.tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">{t.description}</p>

              {t.id === "social" ? (
                <>
                  {overview.plaintextSocialAccounts > 0 ? (
                    <Card className="border-amber-500/40 bg-amber-500/5">
                      <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-amber-900 dark:text-amber-200">
                          {overview.plaintextSocialAccounts} social account{overview.plaintextSocialAccounts === 1 ? " still holds" : "s still hold"} tokens as plain text from before this page existed. Encrypt them into this store and clear the plain-text copies.
                        </span>
                        <Button size="sm" onClick={() => setConfirmMigrate(true)} disabled={busy === "migrate" || overview.migrationMissing || !overview.masterKeySet}>
                          <Lock className="h-3.5 w-3.5" /> Encrypt saved social tokens
                        </Button>
                      </CardContent>
                    </Card>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Connected accounts are added in Social Media → Settings; their tokens appear here once saved.</p>
                </>
              ) : null}

              {renderCards(byTab.get(t.id) ?? [])}

              {t.id === "agents" ? (
                <button
                  type="button"
                  onClick={() => setAddingCustom(true)}
                  disabled={overview.migrationMissing}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Add a custom provider
                </button>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {editing ? (
        <EditDialog
          provider={editing}
          status={overview.statuses[keyOf(editing)]}
          masterKeySet={overview.masterKeySet}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const json = await call("/api/admin/credentials", "PUT", { provider: editing.id, instance: editing.instance ?? "default", values });
            const n = (json.changed?.length ?? 0) + (json.cleared?.length ?? 0);
            setNotice({ kind: "success", text: n ? `${editing.name}: saved ${n} field${n === 1 ? "" : "s"}. Live within a minute.` : `${editing.name}: nothing changed.` });
            setEditing(null);
          }}
        />
      ) : null}

      {removing ? (
        <RemoveDialog
          provider={removing}
          status={overview.statuses[keyOf(removing)]}
          onClose={() => setRemoving(null)}
          onRemove={async (field) => {
            if (field === "__provider__") {
              await call("/api/admin/credentials/custom", "DELETE", { provider: removing.id });
              setNotice({ kind: "success", text: `${removing.name} removed.` });
            } else {
              const json = await call("/api/admin/credentials", "DELETE", { provider: removing.id, instance: removing.instance ?? "default", field: field || undefined });
              setNotice({ kind: "success", text: `${removing.name}: removed ${json.removed?.length ?? 0} saved value(s). Coolify values apply again where set.` });
            }
            setRemoving(null);
          }}
        />
      ) : null}

      <HistorySheet provider={historyFor} headers={headers} onClose={() => setHistoryFor(null)} />

      {addingCustom ? (
        <CustomProviderDialog
          onClose={() => setAddingCustom(false)}
          onCreate={async (payload) => {
            await call("/api/admin/credentials/custom", "POST", payload);
            setNotice({ kind: "success", text: `${payload.name} added. Use Edit to enter its values.` });
            setAddingCustom(false);
          }}
        />
      ) : null}

      <Dialog open={confirmMigrate} onOpenChange={(o) => !o && setConfirmMigrate(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encrypt saved social tokens?</DialogTitle>
            <DialogDescription>
              Each account&apos;s tokens are encrypted into this store first; its plain-text copy is cleared only after every value is saved. Values already saved here are kept. This can&apos;t be undone, and losing the master key afterwards means re-entering these tokens.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmMigrate(false)}>Cancel</Button>
            <Button onClick={migrateSocial} disabled={busy === "migrate"}>
              {busy === "migrate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Encrypt and clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider, status, tabLabel, testing, onEdit, onTest, onRemove, onHistory,
}: {
  provider: CatalogProvider;
  status: ProviderStatus | undefined;
  tabLabel?: string;
  testing: boolean;
  onEdit: () => void;
  onTest: () => void;
  onRemove: () => void;
  onHistory: () => void;
}) {
  const fields = new Map((status?.fields ?? []).map((f) => [f.key, f]));
  const hasDashboard = (status?.fields ?? []).some((f) => f.source === "dashboard");
  const managed = provider.managedInCoolify;
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="space-y-1.5 p-4 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
              <KeyRound className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="break-words">{provider.name}</span>
              {tabLabel ? <Badge variant="outline" className="font-normal">{tabLabel}</Badge> : null}
              {provider.custom ? <Badge variant="outline" className="font-normal">Custom</Badge> : null}
            </CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">{provider.description}</CardDescription>
          </div>
          <ProviderPill provider={provider} status={status} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
        <dl className="divide-y divide-border rounded-lg border border-border text-sm">
          {provider.fields.map((f) => {
            const st = fields.get(f.key) ?? { key: f.key, source: "missing" as const, last4: null, value: null, updatedAt: null, updatedBy: null };
            return (
              <div key={f.key} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                <dt className="min-w-0 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {f.label}
                    {f.required ? <span className="text-destructive" aria-label="required">*</span> : null}
                    {f.help ? (
                      <SimpleTooltip label={<span className="block max-w-[18rem] whitespace-normal text-left leading-snug">{f.help}</span>} side="top">
                        <button
                          type="button"
                          aria-label={`Where to find ${f.label}`}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </SimpleTooltip>
                    ) : null}
                  </span>
                  {f.envVar ? <span className="block truncate font-mono text-[10px] font-normal opacity-80" title={f.envVar}>{f.envVar}</span> : null}
                </dt>
                <dd className="min-w-0"><FieldValue def={f} field={st} managed={managed} /></dd>
                <dd className="sm:justify-self-end"><SourceBadge field={st} managed={managed} /></dd>
              </div>
            );
          })}
        </dl>

        {status?.lastTest ? (
          <p className={cn("text-xs", status.lastTest.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive dark:text-red-300")}>
            Last test {status.lastTest.ok ? "passed" : "failed"} · {fmt(status.lastTest.testedAt)}{status.lastTest.testedBy ? ` · ${status.lastTest.testedBy}` : ""}
            {status.lastTest.message ? <span className="block break-words text-muted-foreground">{status.lastTest.message}</span> : null}
          </p>
        ) : null}
        {status?.updatedAt ? (
          <p className="text-xs text-muted-foreground">Updated by {status.updatedBy ?? "unknown"} · {fmt(status.updatedAt)}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {managed ? (
            <p className="text-xs text-muted-foreground">Managed in Coolify — change it there and redeploy.</p>
          ) : (
            <>
              <Button size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              {provider.testable ? (
                <Button size="sm" variant="outline" onClick={onTest} disabled={testing}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />} Test connection
                </Button>
              ) : null}
              {hasDashboard || provider.custom ? (
                <Button size="sm" variant="outline" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={onHistory}><History className="h-3.5 w-3.5" /> History</Button>
              {provider.docsUrl ? (
                <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  Console <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({
  provider, status, masterKeySet, onClose, onSave,
}: {
  provider: CatalogProvider;
  status: ProviderStatus | undefined;
  masterKeySet: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
}) {
  const fields = new Map((status?.fields ?? []).map((f) => [f.key, f]));
  // Non-secrets start with their dashboard value; secrets always start empty (write-only).
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(provider.fields.map((f) => [f.key, !f.secret && fields.get(f.key)?.source === "dashboard" ? fields.get(f.key)?.value ?? "" : ""])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <DialogHeader>
            <DialogTitle>Edit {provider.name}</DialogTitle>
            <DialogDescription>
              Leave a secret blank to keep the saved one. Clearing a URL or ID falls back to its Coolify variable. Saved values take effect within a minute.
            </DialogDescription>
          </DialogHeader>
          {!masterKeySet && provider.fields.some((f) => f.secret) ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              CREDENTIALS_MASTER_KEY isn&apos;t set, so secrets can&apos;t be saved yet. URLs and IDs can.
            </p>
          ) : null}

          {provider.fields.map((f) => {
            const st = fields.get(f.key);
            const id = `cred-${provider.id}-${f.key}`.replace(/[^a-zA-Z0-9_-]/g, "-");
            const savedSecret = f.secret && st?.source === "dashboard";
            const coolify = st?.source === "coolify";
            const placeholder = savedSecret
              ? `Saved ${st?.last4 ? `••••${st.last4}` : "••••"} — leave blank to keep`
              : f.secret && coolify
                ? `Using Coolify value${st?.last4 ? ` ••••${st.last4}` : ""} — enter one to override`
                : !f.secret && coolify && st?.value
                  ? `Coolify: ${st.value}`
                  : f.placeholder ?? "";
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={id} className="flex items-center gap-1.5">
                  {f.secret ? <Lock className="h-3 w-3 text-muted-foreground" aria-hidden /> : null}
                  {f.label}
                  {f.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                {f.options ? (
                  <FieldSelect
                    id={id}
                    value={values[f.key] ?? ""}
                    onChange={(v) => set(f.key, v)}
                    options={[{ value: "", label: coolify && st?.value ? `Not set here (Coolify: ${st.value})` : "Not set here" }, ...f.options]}
                  />
                ) : f.kind === "json" ? (
                  <Textarea id={id} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={placeholder} rows={5} className="font-mono text-xs" spellCheck={false} />
                ) : (
                  <Input
                    id={id}
                    type={f.secret ? "password" : "text"}
                    inputMode={f.kind === "email" ? "email" : f.kind === "url" ? "url" : undefined}
                    autoComplete={f.secret ? "new-password" : "off"}
                    spellCheck={false}
                    value={values[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={placeholder}
                  />
                )}
                {f.help || f.envVar ? (
                  <p className="text-xs text-muted-foreground">
                    {f.help}
                    {f.envVar ? <span className="ml-1 font-mono text-[10px] opacity-80">Fallback: {f.envVar}</span> : null}
                  </p>
                ) : null}
              </div>
            );
          })}

          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-red-300">{error}</p> : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Remove dialog ────────────────────────────────────────────────────────────

function RemoveDialog({
  provider, status, onClose, onRemove,
}: {
  provider: CatalogProvider;
  status: ProviderStatus | undefined;
  onClose: () => void;
  onRemove: (field: string) => Promise<void>;
}) {
  const saved = (status?.fields ?? []).filter((f) => f.source === "dashboard");
  const options = [
    ...(saved.length ? [{ value: "", label: `All saved values (${saved.length})` }] : []),
    ...saved.map((f) => ({ value: f.key, label: provider.fields.find((x) => x.key === f.key)?.label ?? f.key })),
    ...(provider.custom ? [{ value: "__provider__", label: "The whole custom provider" }] : []),
  ];
  const [choice, setChoice] = useState(options[0]?.value ?? "");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove from {provider.name}?</DialogTitle>
          <DialogDescription>
            Removed values are deleted from the store. Where a Coolify variable exists, the app goes back to using it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>What to remove</Label>
          <FieldSelect value={choice} onChange={setChoice} options={options} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={working || !options.length}
            onClick={async () => {
              setWorking(true);
              setError(null);
              try {
                await onRemove(choice);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Remove failed.");
              } finally {
                setWorking(false);
              }
            }}
          >
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── History sheet ────────────────────────────────────────────────────────────

function HistorySheet({ provider, headers, onClose }: { provider: CatalogProvider | null; headers: Record<string, string>; onClose: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providerId = provider?.id ?? null;
  const instance = provider?.instance ?? "default";

  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    setEntries(null);
    setError(null);
    const url = `/api/admin/credentials?history=${encodeURIComponent(providerId)}&instance=${encodeURIComponent(instance)}`;
    fetch(url, { headers, cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Couldn't load history.");
        if (!cancelled) setEntries(json.history ?? []);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load history."); });
    return () => { cancelled = true; };
  }, [providerId, instance, headers]);

  return (
    <Sheet open={Boolean(provider)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>History · {provider?.name}</SheetTitle>
          <SheetDescription>Who changed or tested these credentials. Values are never logged.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!entries && !error ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p> : null}
          {entries && !entries.length ? <p className="text-sm text-muted-foreground">No changes recorded yet.</p> : null}
          {entries?.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}{e.detail ? ` · ${e.detail}` : ""}</span>
                <span className="text-xs text-muted-foreground">{fmt(e.at)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.actor ?? "Unknown"}
                {e.fields.length ? ` · ${e.fields.map((f) => provider?.fields.find((x) => x.key === f)?.label ?? f).join(", ")}` : ""}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Custom provider dialog ───────────────────────────────────────────────────

function CustomProviderDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (payload: { name: string; description: string; pingUrl: string; fields: { label: string; secret: boolean }[] }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pingUrl, setPingUrl] = useState("");
  const [fields, setFields] = useState<{ label: string; secret: boolean }[]>([
    { label: "Base URL", secret: false },
    { label: "API key", secret: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name, description, pingUrl, fields: fields.filter((f) => f.label.trim()) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the provider.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <DialogHeader>
            <DialogTitle>Add a custom provider</DialogTitle>
            <DialogDescription>For a tool that isn&apos;t listed yet. Define its fields here, then enter the values with Edit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="custom-name">Name *</Label>
            <Input id="custom-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paperclip" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-desc">Description</Label>
            <Input id="custom-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it's used for" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-ping">Ping URL (optional)</Label>
            <Input id="custom-ping" type="url" value={pingUrl} onChange={(e) => setPingUrl(e.target.value)} placeholder="https://… — enables Test connection" />
            <p className="text-xs text-muted-foreground">Test connection sends a GET here, with the first secret field whose name contains key, token or secret as a Bearer token.</p>
          </div>
          <div className="space-y-2">
            <Label>Fields</Label>
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={f.label}
                  onChange={(e) => setFields((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Field name"
                  aria-label={`Field ${i + 1} name`}
                />
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={f.secret} onCheckedChange={(v) => setFields((prev) => prev.map((x, j) => (j === i ? { ...x, secret: v } : x)))} aria-label={`Field ${i + 1} is secret`} />
                  Secret
                </label>
                <Button type="button" size="icon" variant="ghost" onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove field ${i + 1}`} disabled={fields.length <= 1}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setFields((prev) => [...prev, { label: "", secret: true }])} disabled={fields.length >= 20}>
              <Plus className="h-3.5 w-3.5" /> Add field
            </Button>
          </div>
          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-red-300">{error}</p> : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add provider</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
