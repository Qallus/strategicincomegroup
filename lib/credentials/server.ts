import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_MAP } from "@/lib/social-media/constants";
import {
  CUSTOM_PREFIX, DEFINITION_FIELD, ENV_INDEX, PROVIDERS, PROVIDER_MAP, SOCIAL_PREFIX, TABS,
  customProviderFrom, type CatalogField, type CatalogProvider, type CustomDefinition,
} from "./catalog";
import { CredentialsKeyError, decrypt, encrypt, hasMasterKey, last4Of } from "./crypto";
import { REDTAIL_FIELDS } from "@/lib/redtail/env";

// Passwords never show their last characters (keys and tokens do, to tell them apart).
const isPasswordField = (key: string) => /pass(word)?|passphrase/i.test(key);
const hintFor = (key: string, value: string) => (isPasswordField(key) ? null : last4Of(value));
import type { CredentialsOverview, FieldStatus, HistoryEntry, ProviderState, ProviderStatus } from "./types";

// SIG Credentials — server-side store.
//
//   getCredential(provider, field, instance?)  dashboard value → Coolify env var → undefined
//   getProviderConfig(provider, instance?)     every field of a provider at once
//   getCredentialsOverview()                   for the page/API: catalog + status, NEVER values
//
// Reads come from an in-memory snapshot of the `credentials` table that is refreshed every
// 60 seconds and dropped immediately whenever a value is saved, so a new key takes effect
// within a minute without a redeploy. If the table doesn't exist yet, or the master key is
// missing / wrong, every read quietly falls back to the Coolify env var — a live feature is
// never broken by the store.

export const DEFAULT_INSTANCE = "default";
const TTL_MS = 60_000;

/** A user-facing input problem — the API maps it to 400. */
export class CredentialInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialInputError";
  }
}

type Row = {
  id: string;
  provider: string;
  instance: string;
  field: string;
  is_secret: boolean;
  ciphertext: string | null;
  iv: string | null;
  auth_tag: string | null;
  key_version: number | null;
  last4: string | null;
  plain_value: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type Snapshot = {
  at: number;
  rows: Map<string, Row>;
  /** Decrypted values, filled lazily. null = could not decrypt. */
  values: Map<string, string | null>;
  migrationMissing: boolean;
};

const rowKey = (provider: string, instance: string, field: string) => `${provider}\u0000${instance}\u0000${field}`;

let snapshotCache: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;
const warned = new Set<string>();

function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(message);
}

export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /relation .* does not exist|Could not find the table|schema cache/i.test(error.message ?? "");
}

async function loadSnapshot(): Promise<Snapshot> {
  const rows = new Map<string, Row>();
  let migrationMissing = false;
  try {
    const sb = createSupabaseAdminClient();
    const { data, error } = await sb.from("credentials").select("*").limit(5000);
    if (error) {
      if (isMissingRelation(error)) migrationMissing = true;
      else warnOnce(`load:${error.message}`, `[credentials] could not load the store — using Coolify env vars: ${error.message}`);
      // Keep serving the previous snapshot on a transient error.
      if (!migrationMissing && snapshotCache) return { ...snapshotCache, at: Date.now() };
    }
    for (const r of (data ?? []) as Row[]) rows.set(rowKey(r.provider, r.instance, r.field), r);
  } catch (e) {
    warnOnce("load:exception", `[credentials] store unavailable — using Coolify env vars: ${e instanceof Error ? e.message : e}`);
    if (snapshotCache) return { ...snapshotCache, at: Date.now() };
  }
  return { at: Date.now(), rows, values: new Map(), migrationMissing };
}

async function snapshot(): Promise<Snapshot> {
  if (snapshotCache && Date.now() - snapshotCache.at < TTL_MS) return snapshotCache;
  if (!inflight) {
    inflight = loadSnapshot()
      .then((s) => (snapshotCache = s))
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Drop the in-memory snapshot so the next read sees the database. Called on every save. */
export function invalidateCredentialCache() {
  snapshotCache = null;
}

function rowValue(snap: Snapshot, row: Row): string | null {
  const k = rowKey(row.provider, row.instance, row.field);
  if (snap.values.has(k)) return snap.values.get(k)!;
  let value: string | null = null;
  if (!row.is_secret) value = row.plain_value;
  else if (row.ciphertext && row.iv && row.auth_tag) {
    try {
      value = decrypt({ provider: row.provider, instance: row.instance, field: row.field, ciphertext: row.ciphertext, iv: row.iv, auth_tag: row.auth_tag, key_version: row.key_version ?? 1 });
    } catch (e) {
      const why = e instanceof CredentialsKeyError ? e.message : "authentication failed (wrong master key or tampered value)";
      warnOnce(`dec:${k}`, `[credentials] cannot decrypt ${row.provider}/${row.field} — falling back to Coolify: ${why}`);
      value = null;
    }
  }
  snap.values.set(k, value);
  return value;
}

function envValue(field: CatalogField | undefined): string | undefined {
  if (!field) return undefined;
  for (const name of [field.envVar, ...(field.envAliases ?? [])]) {
    if (!name) continue;
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

const staticField = (provider: string, field: string) => PROVIDER_MAP[provider]?.fields.find((f) => f.key === field);

/** Dashboard value first, then the Coolify env var, otherwise undefined. */
export async function getCredential(provider: string, field: string, instance: string = DEFAULT_INSTANCE): Promise<string | undefined> {
  const def = staticField(provider, field);
  if (!PROVIDER_MAP[provider]?.managedInCoolify) {
    const snap = await snapshot();
    const row = snap.rows.get(rowKey(provider, instance, field));
    if (row) {
      const v = rowValue(snap, row)?.trim();
      if (v) return v;
    }
  }
  return instance === DEFAULT_INSTANCE ? envValue(def) : undefined;
}

/** Every field of a provider (catalog fields, or the saved fields of a dynamic provider). */
export async function getProviderConfig(provider: string, instance: string = DEFAULT_INSTANCE): Promise<Record<string, string | undefined>> {
  const def = PROVIDER_MAP[provider];
  const keys = new Set<string>(def ? def.fields.map((f) => f.key) : []);
  if (!def) {
    const snap = await snapshot();
    for (const r of snap.rows.values()) if (r.provider === provider && r.instance === instance && r.field !== DEFINITION_FIELD) keys.add(r.field);
  }
  const out: Record<string, string | undefined> = {};
  await Promise.all([...keys].map(async (k) => { out[k] = await getCredential(provider, k, instance); }));
  return out;
}

/**
 * Presence checker by env var name, for status panels (Analytics → Connections). A var
 * counts as set when its dashboard value exists or the env var is set, so both pages agree.
 */
export async function credentialPresence(): Promise<(...envVars: string[]) => boolean> {
  const snap = await snapshot();
  return (...names: string[]) =>
    names.every((name) => {
      const ref = ENV_INDEX[name];
      if (ref) {
        const row = snap.rows.get(rowKey(ref.provider, DEFAULT_INSTANCE, ref.field));
        if (row && rowValue(snap, row)?.trim()) return true;
      }
      return Boolean(process.env[name]?.trim());
    });
}

// ── Overview for the page / API (never returns secret values) ────────────────

export type { CredentialsOverview, FieldSource, FieldStatus, HistoryEntry, ProviderState, ProviderStatus } from "./types";

export const statusKey = (provider: string, instance: string = DEFAULT_INSTANCE) => `${provider}|${instance}`;

type SocialAccountRow = { id: string; platform: string; display_name: string };

function socialProvider(account: SocialAccountRow, extraFields: string[] = []): CatalogProvider {
  const def = PLATFORM_MAP[account.platform];
  const fields: CatalogField[] = (def?.credentialFields ?? []).map((f) => ({
    key: f.key, label: f.label, secret: f.type === "password", kind: f.type === "password" ? "secret" : f.type === "url" ? "url" : "text", help: f.help,
  }));
  for (const key of extraFields) if (!fields.some((f) => f.key === key)) fields.push({ key, label: key, secret: true, kind: "secret" });
  return {
    id: `${SOCIAL_PREFIX}${account.platform}`,
    tab: "social",
    name: `${def?.label ?? account.platform} · ${account.display_name}`,
    description: "Connected account from Social Media → Settings.",
    instance: account.id,
    social: true,
    fields,
  };
}

function parseDefinition(raw: string | null): CustomDefinition | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as CustomDefinition;
    return d && typeof d.name === "string" && Array.isArray(d.fields) ? d : null;
  } catch {
    return null;
  }
}

async function loadSocialAccounts(): Promise<{ accounts: SocialAccountRow[]; plaintext: number }> {
  try {
    const sb = createSupabaseAdminClient();
    const { data, error } = await sb.from("social_accounts").select("id, platform, display_name, credentials").order("platform");
    if (error) return { accounts: [], plaintext: 0 };
    const rows = (data ?? []) as (SocialAccountRow & { credentials: Record<string, unknown> | null })[];
    const plaintext = rows.filter((r) => Object.values(r.credentials ?? {}).some((v) => String(v ?? "").trim())).length;
    return { accounts: rows.map(({ id, platform, display_name }) => ({ id, platform, display_name })), plaintext };
  } catch {
    return { accounts: [], plaintext: 0 };
  }
}

/** All providers: static catalog + custom definitions + connected social accounts. */
async function allProviders(snap: Snapshot, accounts: SocialAccountRow[]): Promise<CatalogProvider[]> {
  const list: CatalogProvider[] = [...PROVIDERS];
  for (const r of snap.rows.values()) {
    if (r.provider.startsWith(CUSTOM_PREFIX) && r.field === DEFINITION_FIELD) {
      const def = parseDefinition(r.plain_value);
      if (def) list.push(customProviderFrom(r.provider.slice(CUSTOM_PREFIX.length), def));
    }
  }
  for (const a of accounts) {
    const saved = [...snap.rows.values()].filter((r) => r.instance === a.id && r.provider === `${SOCIAL_PREFIX}${a.platform}`).map((r) => r.field);
    list.push(socialProvider(a, saved));
  }
  return list;
}

async function profileNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  const out = new Map<string, string>();
  if (!unique.length) return out;
  try {
    const sb = createSupabaseAdminClient();
    const { data } = await sb.from("profiles").select("id, full_name, email").in("id", unique);
    for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) out.set(p.id, p.full_name || p.email || "Unknown");
  } catch {
    /* names are cosmetic */
  }
  return out;
}

type TestRow = { provider: string; instance: string; ok: boolean; message: string | null; tested_at: string; tested_by: string | null };

export async function getCredentialsOverview(): Promise<CredentialsOverview> {
  invalidateCredentialCache();
  const snap = await snapshot();
  const { accounts, plaintext } = await loadSocialAccounts();
  const providers = await allProviders(snap, accounts);

  let tests: TestRow[] = [];
  if (!snap.migrationMissing) {
    try {
      const { data } = await createSupabaseAdminClient().from("credential_tests").select("provider, instance, ok, message, tested_at, tested_by");
      tests = (data ?? []) as TestRow[];
    } catch {
      tests = [];
    }
  }
  const names = await profileNames([...[...snap.rows.values()].map((r) => r.updated_by), ...tests.map((t) => t.tested_by)]);

  const statuses: Record<string, ProviderStatus> = {};
  for (const p of providers) {
    const instance = p.instance ?? DEFAULT_INSTANCE;
    const dynamic = Boolean(p.custom || p.social);
    const fields: FieldStatus[] = p.fields.map((f) => {
      const row = p.managedInCoolify ? undefined : snap.rows.get(rowKey(p.id, instance, f.key));
      if (row) {
        const value = rowValue(snap, row);
        return {
          key: f.key,
          source: "dashboard",
          last4: row.is_secret && !isPasswordField(f.key) ? row.last4 : null,
          value: row.is_secret ? null : row.plain_value,
          undecryptable: row.is_secret && value === null ? true : undefined,
          updatedAt: row.updated_at,
          updatedBy: row.updated_by ? names.get(row.updated_by) ?? null : null,
        };
      }
      const env = dynamic ? undefined : envValue(f);
      if (env) {
        return {
          key: f.key,
          source: "coolify",
          last4: f.secret && !p.managedInCoolify ? hintFor(f.key, env) : null,
          value: f.secret ? null : env,
          updatedAt: null,
          updatedBy: null,
        };
      }
      return { key: f.key, source: "missing", last4: null, value: null, updatedAt: null, updatedBy: null };
    });

    const test = tests.find((t) => t.provider === p.id && t.instance === instance) ?? null;
    const latest = fields.filter((f) => f.updatedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] ?? null;
    const required = p.fields.filter((f) => f.required).map((f) => f.key);
    // Redtail: complete only when the ACTIVE environment has both its API Key and UserKey.
    if (p.id === "redtail") {
      const env = (fields.find((f) => f.key === "environment")?.value ?? "").toLowerCase() === "production" ? "production" : "development";
      required.push(...Object.values(REDTAIL_FIELDS[env]));
    }
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const anySet = fields.some((f) => f.source !== "missing");
    const missingRequired = required.some((k) => byKey.get(k)?.source === "missing");
    const testFailed = Boolean(test && !test.ok && (!latest?.updatedAt || test.tested_at >= latest.updatedAt));

    let state: ProviderState;
    if (!anySet) state = "missing";
    else if (missingRequired) state = "incomplete";
    else if (testFailed || fields.some((f) => f.undecryptable)) state = "failed";
    else if (!fields.some((f) => f.source === "dashboard")) state = "coolify";
    else state = "connected";

    statuses[statusKey(p.id, instance)] = {
      provider: p.id,
      instance,
      state,
      fields,
      lastTest: test ? { ok: test.ok, message: test.message, testedAt: test.tested_at, testedBy: test.tested_by ? names.get(test.tested_by) ?? null : null } : null,
      updatedAt: latest?.updatedAt ?? null,
      updatedBy: latest?.updatedBy ?? null,
    };
  }

  return { tabs: TABS, providers, statuses, migrationMissing: snap.migrationMissing, masterKeySet: hasMasterKey(), plaintextSocialAccounts: plaintext };
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Resolve an editable provider (static, custom or social). Throws for unknown / Coolify-managed. */
export async function resolveEditableProvider(provider: string, instance: string = DEFAULT_INSTANCE): Promise<CatalogProvider> {
  const stat = PROVIDER_MAP[provider];
  if (stat) {
    if (stat.managedInCoolify) throw new CredentialInputError(`${stat.name} is managed in Coolify and can't be stored here.`);
    if (instance !== DEFAULT_INSTANCE) throw new CredentialInputError("This provider has a single instance.");
    return stat;
  }
  const sb = createSupabaseAdminClient();
  if (provider.startsWith(CUSTOM_PREFIX)) {
    const { data } = await sb.from("credentials").select("plain_value").eq("provider", provider).eq("instance", DEFAULT_INSTANCE).eq("field", DEFINITION_FIELD).maybeSingle();
    const def = parseDefinition((data as { plain_value: string | null } | null)?.plain_value ?? null);
    if (!def || instance !== DEFAULT_INSTANCE) throw new CredentialInputError("Unknown custom provider.");
    return customProviderFrom(provider.slice(CUSTOM_PREFIX.length), def);
  }
  if (provider.startsWith(SOCIAL_PREFIX)) {
    const { data } = await sb.from("social_accounts").select("id, platform, display_name").eq("id", instance).maybeSingle();
    const account = data as SocialAccountRow | null;
    if (!account || `${SOCIAL_PREFIX}${account.platform}` !== provider) throw new CredentialInputError("Unknown social account.");
    return socialProvider(account);
  }
  throw new CredentialInputError(`Unknown provider "${provider}".`);
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function validate(field: CatalogField, value: string) {
  if (value.length > 20000) throw new CredentialInputError(`${field.label} is too long.`);
  if (field.options && !field.options.some((o) => o.value === value)) throw new CredentialInputError(`${field.label} must be one of: ${field.options.map((o) => o.value).join(", ")}.`);
  if (field.kind === "url" && !/^https?:\/\/[^\s]+$/i.test(value)) throw new CredentialInputError(`${field.label} must be an http(s) URL.`);
  if (field.kind === "email" && !EMAIL_RE.test(value) && !/^[^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/.test(value)) throw new CredentialInputError(`${field.label} must be an email address.`);
  if (field.kind === "json") {
    try { JSON.parse(value); } catch { throw new CredentialInputError(`${field.label} must be valid JSON.`); }
  }
}

/**
 * Save a provider's fields. A blank secret keeps the saved value; a blank non-secret
 * removes the dashboard value (the Coolify env var applies again). Returns field names only.
 */
export async function saveProviderValues(input: {
  provider: string;
  instance?: string;
  values: Record<string, unknown>;
  actorId: string | null;
}): Promise<{ changed: string[]; cleared: string[] }> {
  const instance = input.instance || DEFAULT_INSTANCE;
  const def = await resolveEditableProvider(input.provider, instance);
  const sb = createSupabaseAdminClient();
  const { data: existingRows, error: loadError } = await sb.from("credentials").select("id, field").eq("provider", input.provider).eq("instance", instance);
  if (loadError) {
    if (isMissingRelation(loadError)) throw new CredentialInputError("Run supabase/migrations/202611250210_credentials.sql first.");
    throw new Error(loadError.message);
  }
  const existing = new Map(((existingRows ?? []) as { id: string; field: string }[]).map((r) => [r.field, r.id]));
  const now = new Date().toISOString();
  const changed: string[] = [];
  const cleared: string[] = [];

  for (const [key, raw] of Object.entries(input.values ?? {})) {
    const field = def.fields.find((f) => f.key === key);
    if (!field) throw new CredentialInputError(`Unknown field "${key}" for ${def.name}.`);
    const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();

    if (!value) {
      if (field.secret) continue; // blank secret = keep what's saved
      if (existing.has(key)) {
        const { error } = await sb.from("credentials").delete().eq("id", existing.get(key)!);
        if (error) throw new Error(error.message);
        cleared.push(key);
      }
      continue;
    }

    validate(field, value);
    let payload: Record<string, unknown>;
    if (field.secret) {
      let enc;
      try {
        enc = encrypt(value, input.provider, instance, key);
      } catch (e) {
        if (e instanceof CredentialsKeyError) throw new CredentialInputError(e.message);
        throw e;
      }
      payload = { is_secret: true, ...enc, last4: hintFor(key, value), plain_value: null };
    } else {
      payload = { is_secret: false, plain_value: value, ciphertext: null, iv: null, auth_tag: null, key_version: null, last4: null };
    }

    const id = existing.get(key);
    const { error } = id
      ? await sb.from("credentials").update({ ...payload, updated_by: input.actorId, updated_at: now }).eq("id", id)
      : await sb.from("credentials").insert({ ...payload, provider: input.provider, instance, field: key, created_by: input.actorId, updated_by: input.actorId, created_at: now, updated_at: now });
    if (error) throw new Error(error.message);
    changed.push(key);
  }

  invalidateCredentialCache();
  return { changed, cleared };
}

/** Remove one field, or every saved field of a provider instance (definitions are kept). */
export async function deleteCredentials(input: { provider: string; instance?: string; field?: string }): Promise<{ removed: string[] }> {
  const instance = input.instance || DEFAULT_INSTANCE;
  if (PROVIDER_MAP[input.provider]?.managedInCoolify) throw new CredentialInputError("Coolify-managed values can't be removed here.");
  if (input.field === DEFINITION_FIELD) throw new CredentialInputError("Remove a custom provider from its own menu.");
  const sb = createSupabaseAdminClient();
  let q = sb.from("credentials").delete().eq("provider", input.provider).eq("instance", instance).neq("field", DEFINITION_FIELD);
  if (input.field) q = q.eq("field", input.field);
  const { data, error } = await q.select("field");
  if (error) throw new Error(error.message);
  if (!input.field) await sb.from("credential_tests").delete().eq("provider", input.provider).eq("instance", instance);
  invalidateCredentialCache();
  return { removed: ((data ?? []) as { field: string }[]).map((r) => r.field) };
}

export async function recordTestResult(input: { provider: string; instance?: string; ok: boolean; message: string; actorId: string | null }) {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("credential_tests").upsert(
    { provider: input.provider, instance: input.instance || DEFAULT_INSTANCE, ok: input.ok, message: input.message.slice(0, 500), tested_at: new Date().toISOString(), tested_by: input.actorId },
    { onConflict: "provider,instance" },
  );
  if (error && !isMissingRelation(error)) throw new Error(error.message);
}

// ── Custom providers ─────────────────────────────────────────────────────────

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const fieldKeyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);

export async function createCustomProvider(input: { name: string; description?: string; pingUrl?: string; fields: { label: string; secret: boolean }[]; actorId: string | null }): Promise<string> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) throw new CredentialInputError("Give the provider a name.");
  const slug = slugify(name);
  if (!slug) throw new CredentialInputError("Use letters or numbers in the name.");
  const pingUrl = String(input.pingUrl ?? "").trim();
  if (pingUrl && !/^https?:\/\/\S+$/i.test(pingUrl)) throw new CredentialInputError("The ping URL must be an http(s) URL.");
  const fields: CustomDefinition["fields"] = [];
  for (const f of input.fields ?? []) {
    const label = String(f.label ?? "").trim().slice(0, 80);
    if (!label) continue;
    const key = fieldKeyOf(label);
    if (!key || key === DEFINITION_FIELD.replace(/^_+/, "") || fields.some((x) => x.key === key)) throw new CredentialInputError(`Field "${label}" is duplicated or invalid.`);
    fields.push({ key, label, secret: Boolean(f.secret) });
  }
  if (!fields.length) throw new CredentialInputError("Add at least one field.");
  if (fields.length > 20) throw new CredentialInputError("Up to 20 fields per provider.");

  const provider = `${CUSTOM_PREFIX}${slug}`;
  const sb = createSupabaseAdminClient();
  const { data: clash } = await sb.from("credentials").select("id").eq("provider", provider).eq("field", DEFINITION_FIELD).maybeSingle();
  if (clash) throw new CredentialInputError("A custom provider with that name already exists.");
  const def: CustomDefinition = { name, description: String(input.description ?? "").trim().slice(0, 300) || undefined, pingUrl: pingUrl || undefined, fields };
  const now = new Date().toISOString();
  const { error } = await sb.from("credentials").insert({
    provider, instance: DEFAULT_INSTANCE, field: DEFINITION_FIELD, is_secret: false, plain_value: JSON.stringify(def),
    created_by: input.actorId, updated_by: input.actorId, created_at: now, updated_at: now,
  });
  if (error) {
    if (isMissingRelation(error)) throw new CredentialInputError("Run supabase/migrations/202611250210_credentials.sql first.");
    throw new Error(error.message);
  }
  invalidateCredentialCache();
  return provider;
}

export async function getCustomDefinition(provider: string): Promise<CustomDefinition | null> {
  const snap = await snapshot();
  return parseDefinition(snap.rows.get(rowKey(provider, DEFAULT_INSTANCE, DEFINITION_FIELD))?.plain_value ?? null);
}

export async function deleteCustomProvider(provider: string): Promise<void> {
  if (!provider.startsWith(CUSTOM_PREFIX)) throw new CredentialInputError("Not a custom provider.");
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("credentials").delete().eq("provider", provider);
  if (error) throw new Error(error.message);
  await sb.from("credential_tests").delete().eq("provider", provider);
  invalidateCredentialCache();
}

// ── History (audit log) ──────────────────────────────────────────────────────

export async function getCredentialHistory(provider: string, instance: string = DEFAULT_INSTANCE): Promise<HistoryEntry[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("user_activity_logs")
    .select("id, action, created_at, actor_user_id, metadata")
    .eq("entity_type", "credential")
    .eq("metadata->>provider", provider)
    .eq("metadata->>instance", instance)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; action: string; created_at: string; actor_user_id: string | null; metadata: Record<string, unknown> }[];
  const names = await profileNames(rows.map((r) => r.actor_user_id));
  return rows.map((r) => {
    const m = r.metadata ?? {};
    const fields = [...(Array.isArray(m.fields) ? m.fields : []), ...(Array.isArray(m.cleared) ? m.cleared : [])].map(String);
    const detail = typeof m.result === "string" ? m.result : null;
    return { id: r.id, action: r.action, at: r.created_at, actor: r.actor_user_id ? names.get(r.actor_user_id) ?? null : null, fields, detail };
  });
}

// ── Social accounts ──────────────────────────────────────────────────────────

export type SocialCredentialStatus = Record<string, Record<string, { set: boolean; last4: string | null; value: string | null }>>;

/** Masked status per social account for Social Media → Settings. Never returns secrets. */
export async function getSocialCredentialStatus(accounts: { id: string; platform: string }[]): Promise<SocialCredentialStatus> {
  invalidateCredentialCache();
  const snap = await snapshot();
  const out: SocialCredentialStatus = {};
  for (const a of accounts) {
    const provider = `${SOCIAL_PREFIX}${a.platform}`;
    const entry: SocialCredentialStatus[string] = {};
    for (const r of snap.rows.values()) {
      if (r.provider !== provider || r.instance !== a.id) continue;
      entry[r.field] = { set: true, last4: r.is_secret ? r.last4 : null, value: r.is_secret ? null : r.plain_value };
    }
    out[a.id] = entry;
  }
  return out;
}

/** Decrypted tokens for one social account — for the publish adapter only. */
export async function getSocialAccountCredentials(account: { id: string; platform: string }): Promise<Record<string, string | undefined>> {
  return getProviderConfig(`${SOCIAL_PREFIX}${account.platform}`, account.id);
}

export async function deleteSocialAccountCredentials(accountId: string): Promise<void> {
  try {
    const sb = createSupabaseAdminClient();
    await sb.from("credentials").delete().like("provider", `${SOCIAL_PREFIX}%`).eq("instance", accountId);
    await sb.from("credential_tests").delete().like("provider", `${SOCIAL_PREFIX}%`).eq("instance", accountId);
  } finally {
    invalidateCredentialCache();
  }
}

type PlaintextAccount = SocialAccountRow & { credentials: Record<string, unknown> | null };

/**
 * Move one account's plain-text social_accounts.credentials into the encrypted store, then
 * clear the column. A field that already has a dashboard value keeps it (it is newer).
 * Returns the number of fields moved. Throws without clearing anything if a write fails.
 */
async function moveAccountPlaintext(a: PlaintextAccount, actorId: string | null): Promise<number> {
  const sb = createSupabaseAdminClient();
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.credentials ?? {})) {
    const s = String(v ?? "").trim();
    if (s && /^[a-z0-9_]{1,64}$/.test(k)) values[k] = s;
  }
  const hadAnything = Boolean(a.credentials && Object.keys(a.credentials).length);
  const now = new Date().toISOString();
  let moved = 0;
  if (Object.keys(values).length) {
    const provider = `${SOCIAL_PREFIX}${a.platform}`;
    const { data: existingRows, error: exErr } = await sb.from("credentials").select("field").eq("provider", provider).eq("instance", a.id);
    if (exErr) throw new Error(exErr.message);
    const existing = new Set(((existingRows ?? []) as { field: string }[]).map((r) => r.field));
    const known = new Map(socialProvider(a).fields.map((f) => [f.key, f]));
    for (const [key, value] of Object.entries(values)) {
      if (existing.has(key)) continue;
      const isSecret = known.get(key)?.secret ?? true;
      const payload = isSecret
        ? { is_secret: true, ...encrypt(value, provider, a.id, key), last4: hintFor(key, value), plain_value: null }
        : { is_secret: false, plain_value: value, ciphertext: null, iv: null, auth_tag: null, key_version: null, last4: null };
      const { error } = await sb.from("credentials").insert({ ...payload, provider, instance: a.id, field: key, created_by: actorId, updated_by: actorId, created_at: now, updated_at: now });
      if (error) throw new Error(error.message);
      moved += 1;
    }
  }
  if (hadAnything) {
    const { error } = await sb.from("social_accounts").update({ credentials: {}, updated_at: now }).eq("id", a.id);
    if (error) throw new Error(error.message);
  }
  invalidateCredentialCache();
  return moved;
}

/** Move a single account's leftover plain-text tokens (called before saving it). */
export async function moveSocialAccountPlaintext(accountId: string, actorId: string | null): Promise<number> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb.from("social_accounts").select("id, platform, display_name, credentials").eq("id", accountId).maybeSingle();
  if (error || !data) return 0;
  const a = data as PlaintextAccount;
  if (!a.credentials || !Object.keys(a.credentials).length) return 0;
  if (!hasMasterKey()) throw new CredentialInputError("Set CREDENTIALS_MASTER_KEY in Coolify before saving social tokens.");
  return moveAccountPlaintext(a, actorId);
}

/**
 * One-time move of plain-text social_accounts.credentials into the encrypted store
 * (Credentials → Social → "Encrypt saved social tokens"). Per account, every non-empty value
 * is encrypted first and the plain-text column is cleared only after all of them are saved.
 * Safe to run again. Returns counts only — never values.
 */
export async function migrateSocialPlaintext(actorId: string | null): Promise<{ accounts: number; fields: number; failed: { accountId: string; error: string }[] }> {
  if (!hasMasterKey()) throw new CredentialInputError("Set CREDENTIALS_MASTER_KEY in Coolify and redeploy before moving social tokens.");
  const sb = createSupabaseAdminClient();
  const { error: probeErr } = await sb.from("credentials").select("id").limit(1);
  if (probeErr && isMissingRelation(probeErr)) throw new CredentialInputError("Run supabase/migrations/202611250210_credentials.sql first.");
  const { data, error } = await sb.from("social_accounts").select("id, platform, display_name, credentials");
  if (error) throw new Error(error.message);
  let accounts = 0;
  let fields = 0;
  const failed: { accountId: string; error: string }[] = [];
  for (const a of (data ?? []) as PlaintextAccount[]) {
    if (!a.credentials || !Object.keys(a.credentials).length) continue;
    try {
      fields += await moveAccountPlaintext(a, actorId);
      accounts += 1;
    } catch (e) {
      failed.push({ accountId: a.id, error: e instanceof Error ? e.message : "Move failed." });
    }
  }
  invalidateCredentialCache();
  return { accounts, fields, failed };
}
