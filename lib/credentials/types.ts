// SIG Credentials — shared types only (no values, no server code). Safe for client
// components; everything that touches secrets lives in the server-only modules.

export type FieldKind = "secret" | "url" | "id" | "email" | "model" | "json" | "text";

export type CatalogField = {
  key: string;
  label: string;
  /** Coolify env var used when no dashboard value is saved. */
  envVar?: string;
  /** Older env var names still honoured as fallbacks, in order. */
  envAliases?: string[];
  secret: boolean;
  kind: FieldKind;
  required?: boolean;
  help?: string;
  placeholder?: string;
  docsUrl?: string;
  /** Fixed choices — rendered with the SIG FieldSelect, never a native select. */
  options?: { value: string; label: string }[];
};

export type TabId = "crm" | "email" | "voice" | "microsoft" | "google" | "social" | "ai" | "agents" | "data_feeds" | "platform";

export type CatalogTab = { id: TabId; label: string; description: string };

export type CatalogProvider = {
  id: string;
  tab: TabId;
  name: string;
  description: string;
  docsUrl?: string;
  fields: CatalogField[];
  /** A "Test connection" check exists in lib/credentials/tests.ts. */
  testable?: boolean;
  /** Status only — values must stay in Coolify. */
  managedInCoolify?: boolean;
  /** Dynamic providers: social accounts and custom providers. */
  instance?: string;
  custom?: boolean;
  social?: boolean;
};

export type CustomDefinition = {
  name: string;
  description?: string;
  pingUrl?: string;
  fields: { key: string; label: string; secret: boolean; kind?: FieldKind }[];
};

export type FieldSource = "dashboard" | "coolify" | "missing";

export type FieldStatus = {
  key: string;
  source: FieldSource;
  /** Last four characters of a secret, when long enough. */
  last4: string | null;
  /** Full value — non-secret fields only. */
  value: string | null;
  /** A dashboard secret that can't be decrypted with the current master key. */
  undecryptable?: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ProviderState = "connected" | "coolify" | "incomplete" | "missing" | "failed";

export type ProviderStatus = {
  provider: string;
  instance: string;
  state: ProviderState;
  fields: FieldStatus[];
  lastTest: { ok: boolean; message: string | null; testedAt: string; testedBy: string | null } | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type CredentialsOverview = {
  tabs: CatalogTab[];
  providers: CatalogProvider[];
  /** Keyed by `${provider}|${instance}`. */
  statuses: Record<string, ProviderStatus>;
  migrationMissing: boolean;
  masterKeySet: boolean;
  /** Social accounts still holding plain-text tokens in social_accounts.credentials. */
  plaintextSocialAccounts: number;
};

export type HistoryEntry = { id: string; action: string; at: string; actor: string | null; fields: string[]; detail: string | null };
