import "server-only";

// SIG Credentials catalog — the single source of truth for the Credentials page tabs,
// the providers on each tab and their fields. Every field names the Coolify env var it
// falls back to, so `getCredential()` reads the dashboard value first and the env var
// second. Adding an integration = adding a provider here (no migration).
//
// NAMING RULE: every field label is the provider's own term, exactly as it appears in that
// provider's console (e.g. Supabase "Direct connection string", Entra "Application (client) ID"),
// and `help` starts with "Where to find it:" and the console path. Keep this when adding fields.
//
// Kept JSON-serialisable (no functions) so it can be sent to the page as-is; connection
// tests live in ./tests.ts keyed by provider id.

import type { CatalogField, CatalogProvider, CatalogTab, CustomDefinition, FieldKind } from "./types";

export type { CatalogField, CatalogProvider, CatalogTab, CustomDefinition, FieldKind, TabId } from "./types";

export const TABS: CatalogTab[] = [
  { id: "crm", label: "CRM", description: "Client relationship systems." },
  { id: "email", label: "Email", description: "Sending, inbox sync and notification addresses." },
  { id: "voice", label: "Voice & SMS", description: "Phone numbers, texting and the browser phone." },
  { id: "microsoft", label: "Microsoft 365", description: "Azure app registration for Outlook mail and calendar sync." },
  { id: "google", label: "Google", description: "Search Console, Business Profile, Maps and Google sign-in." },
  { id: "social", label: "Social", description: "Platform apps and each connected social account." },
  { id: "ai", label: "AI models", description: "Model providers used by Siggy, the editor assistant and transcription." },
  { id: "agents", label: "Agents & harnesses", description: "Agent runtimes and any custom service." },
  { id: "data_feeds", label: "Data feeds", description: "Market quotes and other live data shown on the dashboard." },
  { id: "platform", label: "Platform", description: "Core secrets that must stay in Coolify. Status only." },
];

const secret = (key: string, label: string, envVar: string, extra: Partial<CatalogField> = {}): CatalogField => ({ key, label, envVar, secret: true, kind: "secret", ...extra });
const plain = (key: string, label: string, envVar: string, kind: Exclude<FieldKind, "secret">, extra: Partial<CatalogField> = {}): CatalogField => ({ key, label, envVar, secret: false, kind, ...extra });
const BOOL = [{ value: "true", label: "Yes (TLS)" }, { value: "false", label: "No" }];

export const PROVIDERS: CatalogProvider[] = [
  // ── CRM ──
  {
    id: "redtail", tab: "crm", name: "Redtail CRM", testable: true,
    description: "Read access for the Phase 3 contact sync. Use the user key; username and password are only needed once to fetch it.",
    docsUrl: "https://corporate.redtailtechnology.com/api/",
    fields: [
      plain("base_url", "API base URL", "REDTAIL_API_BASE_URL", "url", { placeholder: "https://review.crm.redtailtechnology.com/api/public/v1", help: "Where to find it: Redtail API documentation. Sandbox (review) while testing; production is https://smf.crm3.redtailtechnology.com/api/public/v1." }),
      secret("api_key", "API Key", "REDTAIL_API_KEY", { required: true, help: "Where to find it: issued to SIG by Redtail's Integration Partner program (partner welcome email)." }),
      secret("user_key", "User Key", "REDTAIL_USER_KEY", { help: "Where to find it: returned by Redtail's authentication call (API Key + Redtail username and password). Preferred over storing the password." }),
      plain("username", "Redtail username", "REDTAIL_USERNAME", "text", { help: "The Redtail CRM login used to fetch the User Key." }),
      secret("password", "Redtail password", "REDTAIL_PASSWORD", { help: "Only needed once to fetch the User Key; clear it afterwards." }),
    ],
  },
  // ── Email ──
  {
    id: "resend", tab: "email", name: "Resend", testable: true,
    description: "All outbound email (password resets, notifications, journeys). Used before SMTP when the API key is set.",
    docsUrl: "https://resend.com/api-keys",
    fields: [
      secret("api_key", "API Key", "RESEND_API_KEY", { required: true, placeholder: "re_…", help: "Where to find it: Resend → API Keys → Create API Key (shown once)." }),
      plain("from_email", "From address", "RESEND_FROM_EMAIL", "email", { required: true, placeholder: "planning@strategicincomegroup.com", help: "Must be on a domain verified in Resend → Domains. Sending refuses to fall back to another address." }),
      plain("from_name", "From name", "RESEND_FROM_NAME", "text", { placeholder: "SIG" }),
      plain("reply_to", "Reply-To address", "RESEND_REPLY_TO", "email"),
      secret("webhook_secret", "Webhook Signing Secret", "RESEND_WEBHOOK_SECRET", { help: "Where to find it: Resend → Webhooks → the /api/webhooks/resend endpoint → Signing Secret (starts with whsec_)." }),
      plain("audience_id", "Audience ID", "RESEND_AUDIENCE_ID", "id", { help: "Where to find it: Resend → Audiences → the audience → ID." }),
    ],
  },
  {
    id: "smtp", tab: "email", name: "SMTP (outgoing)", testable: true,
    description: "Fallback sender when no Resend key is set.",
    fields: [
      plain("host", "SMTP server (outgoing)", "SMTP_HOST", "text", { required: true, placeholder: "smtp.hostinger.com", help: "Where to find it: your email host's mail settings (e.g. Hostinger → Emails → Configuration)." }),
      plain("port", "SMTP port", "SMTP_PORT", "text", { required: true, placeholder: "465" }),
      plain("user", "Email address (username)", "SMTP_USER", "text", { required: true, envAliases: ["MAIL_JW_USERNAME"] }),
      secret("password", "Email account password", "SMTP_PASSWORD", { required: true, envAliases: ["MAIL_JW_PASSWORD"] }),
      plain("secure", "SSL/TLS", "SMTP_SECURE", "text", { options: BOOL, help: "Leave unset to use SSL/TLS on port 465." }),
    ],
  },
  {
    id: "imap", tab: "email", name: "IMAP (inbox sync)", testable: true,
    description: "Pulls replies into the dashboard Email inbox.",
    fields: [
      plain("host", "IMAP server (incoming)", "IMAP_HOST", "text", { required: true, placeholder: "imap.hostinger.com", help: "Where to find it: your email host's mail settings (e.g. Hostinger → Emails → Configuration)." }),
      plain("port", "IMAP port", "IMAP_PORT", "text", { required: true, placeholder: "993" }),
      plain("user", "Email address (username)", "IMAP_USER", "text", { required: true, envAliases: ["MAIL_JW_USERNAME", "SMTP_USER"] }),
      secret("password", "Email account password", "IMAP_PASSWORD", { required: true, envAliases: ["MAIL_JW_PASSWORD", "SMTP_PASSWORD"] }),
      plain("secure", "SSL/TLS", "IMAP_SECURE", "text", { options: BOOL }),
    ],
  },
  {
    id: "notifications", tab: "email", name: "Notification addresses",
    description: "Where internal notices go, and who is silently copied on challenge and invitation emails.",
    fields: [
      plain("from_email", "SMTP from address", "NOTIFICATION_FROM_EMAIL", "email", { help: "Sender for SMTP sends (Resend uses its own from email)." }),
      plain("edit_request_email", "Edit request inbox", "EDIT_REQUEST_NOTIFY_EMAIL", "email", { placeholder: "jwaters@qallus.co", help: "Always emailed when a page or dashboard edit request is filed." }),
      plain("monitor_bcc", "Monitoring BCC", "EMAIL_MONITOR_BCC", "text", { help: "Comma-separated. Silent BCC on 6-Week Challenge and invitation emails only. Leave empty to turn off." }),
    ],
  },
  // ── Voice & SMS ──
  {
    id: "twilio", tab: "voice", name: "Twilio", testable: true,
    description: "SMS, inbound/outbound calls, recordings and the browser phone.",
    docsUrl: "https://console.twilio.com/",
    fields: [
      plain("account_sid", "Account SID", "TWILIO_ACCOUNT_SID", "id", { required: true, placeholder: "AC…", help: "Where to find it: Twilio Console home → Account Info → Account SID." }),
      secret("auth_token", "Auth Token", "TWILIO_AUTH_TOKEN", { required: true, help: "Where to find it: Twilio Console home → Account Info → Auth Token. Also verifies Twilio webhook signatures." }),
      plain("api_key", "API Key SID", "TWILIO_API_KEY", "id", { placeholder: "SK…", help: "Where to find it: Twilio Console → Account → API keys & tokens → the key's SID. Used for browser-phone access tokens." }),
      secret("api_secret", "API Key Secret", "TWILIO_API_SECRET", { help: "Shown once when the API key is created." }),
      plain("twiml_app_sid", "TwiML App SID", "TWILIO_TWIML_APP_SID", "id", { placeholder: "AP…", help: "Where to find it: Twilio Console → Voice → TwiML → TwiML Apps → the app's SID." }),
      plain("messaging_service_sid", "Messaging Service SID", "TWILIO_MESSAGING_SERVICE_SID", "id", { placeholder: "MG…", help: "Where to find it: Twilio Console → Messaging → Services → the service's SID. Carries the A2P 10DLC campaign; without it US carriers reject texts (error 30034)." }),
      plain("phone_number", "Phone Number", "TWILIO_PHONE_NUMBER", "text", { placeholder: "+14804393335", help: "Where to find it: Twilio Console → Phone Numbers → Active numbers (E.164 format)." }),
      plain("forwarding_number", "Forwarding number", "TWILIO_FORWARDING_NUMBER", "text", { help: "SIG setting, not a Twilio field. Reserved for call forwarding." }),
    ],
  },
  // ── Microsoft 365 ──
  {
    id: "microsoft", tab: "microsoft", name: "Microsoft Entra app registration (Graph)", testable: true,
    description: "App registration for Outlook mail and calendar sync.",
    docsUrl: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    fields: [
      plain("tenant_id", "Directory (tenant) ID", "AZURE_TENANT_ID", "id", { required: true, help: "Where to find it: Microsoft Entra admin center → App registrations → the app → Overview." }),
      plain("client_id", "Application (client) ID", "AZURE_CLIENT_ID", "id", { required: true, help: "Where to find it: Microsoft Entra admin center → App registrations → the app → Overview." }),
      secret("client_secret", "Client secret Value", "AZURE_CLIENT_SECRET", { required: true, help: "Where to find it: the app → Certificates & secrets → Client secrets → the Value column (shown once). Not the Secret ID." }),
      plain("redirect_uri", "Redirect URI", "AZURE_REDIRECT_URI", "url", { help: "Where to find it: the app → Authentication → Platform configurations → Web → Redirect URIs." }),
      plain("mailboxes", "Outlook mailboxes to sync", "OUTLOOK_SYNC_MAILBOXES", "text", { help: "SIG setting. Comma-separated mailbox addresses." }),
      plain("scopes", "API permissions (Graph scopes)", "MS_GRAPH_SCOPES", "text", { placeholder: "Mail.Read Calendars.ReadWrite offline_access", help: "Where to find it: the app → API permissions. Space-separated." }),
    ],
  },
  // ── Google ──
  {
    id: "google", tab: "google", name: "Google", testable: true,
    description: "Search Console and Business Profile (service account), plus Maps and Google sign-in.",
    docsUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
    fields: [
      secret("service_account_json", "Service account key (JSON)", "GOOGLE_SA_JSON", { kind: "json", help: "Where to find it: Google Cloud console → IAM & Admin → Service Accounts → the account → Keys → Add key → JSON. Paste the whole file." }),
      plain("gsc_site_url", "Search Console property", "GSC_SITE_URL", "text", { placeholder: "sc-domain:strategicincomegroup.com", help: "Where to find it: Search Console → property selector. Domain properties are written sc-domain:example.com." }),
      plain("gbp_location_id", "Business Profile ID", "GBP_LOCATION_ID", "id", { help: "Where to find it: Google Business Profile → Business Profile settings → Advanced settings → Business Profile ID." }),
      plain("oauth_client_id", "OAuth 2.0 Client ID", "GOOGLE_OAUTH_CLIENT_ID", "id", { help: "Where to find it: Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client IDs. For Calendar / Gmail later." }),
      secret("oauth_client_secret", "Client secret", "GOOGLE_OAUTH_CLIENT_SECRET", { help: "Same OAuth 2.0 client → Client secrets." }),
      secret("maps_api_key", "Maps Platform API key", "GOOGLE_MAPS_API_KEY", { help: "Where to find it: Google Cloud console → APIs & Services → Credentials → API keys (restricted to Maps APIs)." }),
    ],
  },
  // ── Social (apps; connected accounts are added dynamically) ──
  {
    id: "meta", tab: "social", name: "Meta app (Facebook & Instagram)", testable: true,
    description: "App credentials for Page and Instagram insights and posting.",
    docsUrl: "https://developers.facebook.com/apps/",
    fields: [
      plain("app_id", "App ID", "META_APP_ID", "id", { required: true, help: "Where to find it: Meta for Developers → My Apps → the app → App settings → Basic." }),
      secret("app_secret", "App Secret", "META_APP_SECRET", { required: true, help: "Where to find it: App settings → Basic → App Secret → Show." }),
    ],
  },
  {
    id: "linkedin", tab: "social", name: "LinkedIn app",
    description: "Community Management API app for company page posts and stats.",
    docsUrl: "https://www.linkedin.com/developers/apps",
    fields: [
      plain("client_id", "Client ID", "LINKEDIN_CLIENT_ID", "id", { required: true, help: "Where to find it: LinkedIn Developers → My apps → the app → Auth → Application credentials." }),
      secret("client_secret", "Primary Client Secret", "LINKEDIN_CLIENT_SECRET", { required: true, help: "Where to find it: the app → Auth → Application credentials → Primary Client Secret." }),
    ],
  },
  // ── AI models ──
  {
    id: "openai", tab: "ai", name: "OpenAI", testable: true,
    description: "Siggy, the Frontend Editor assistant, Workspace AI and call/voice-note transcription.",
    docsUrl: "https://platform.openai.com/api-keys",
    fields: [
      secret("api_key", "API key (secret key)", "OPENAI_API_KEY", { required: true, placeholder: "sk-…", help: "Where to find it: OpenAI Platform → API keys → Create new secret key (shown once)." }),
      plain("chat_model", "Chat model", "OPENAI_MODEL", "model", { placeholder: "gpt-4o" }),
      plain("transcribe_model", "Transcription model", "OPENAI_TRANSCRIBE_MODEL", "model", { placeholder: "whisper-1" }),
      plain("base_url", "API base URL", "OPENAI_BASE_URL", "url", { placeholder: "https://api.openai.com/v1", help: "Leave empty for OpenAI's default." }),
    ],
  },
  {
    id: "anthropic", tab: "ai", name: "Anthropic (Claude)", testable: true,
    description: "Claude models, ready for future features.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    fields: [
      secret("api_key", "API key", "ANTHROPIC_API_KEY", { required: true, placeholder: "sk-ant-…", help: "Where to find it: Claude Console → Settings → API keys → Create Key (shown once)." }),
      plain("model", "Default model", "ANTHROPIC_MODEL", "model"),
    ],
  },
  {
    id: "xai", tab: "ai", name: "xAI (Grok)", testable: true,
    description: "Grok chat and realtime voice.",
    docsUrl: "https://console.x.ai/",
    fields: [
      secret("api_key", "API key", "XAI_API_KEY", { required: true, placeholder: "xai-…", help: "Where to find it: xAI Console → API Keys → Create API key (shown once)." }),
      plain("chat_model", "Chat model", "XAI_MODEL", "model"),
      plain("voice_model", "Voice / realtime model", "XAI_VOICE_MODEL", "model"),
      plain("voice", "Voice name", "XAI_VOICE", "text"),
    ],
  },
  {
    id: "openrouter", tab: "ai", name: "OpenRouter", testable: true,
    description: "One key for many model vendors.",
    docsUrl: "https://openrouter.ai/settings/keys",
    fields: [
      secret("api_key", "API key", "OPENROUTER_API_KEY", { required: true, placeholder: "sk-or-…", help: "Where to find it: OpenRouter → Settings → API Keys → Create Key (shown once)." }),
      plain("base_url", "API base URL", "OPENROUTER_BASE_URL", "url", { placeholder: "https://openrouter.ai/api/v1", help: "Leave empty for OpenRouter's default." }),
      plain("model", "Default model", "OPENROUTER_MODEL", "model"),
    ],
  },
  // ── Agents & harnesses ──
  {
    id: "hermes", tab: "agents", name: "Hermes", testable: true,
    description: "Hermes agent harness.",
    fields: [
      plain("base_url", "Base URL", "HERMES_BASE_URL", "url", { required: true }),
      secret("api_key", "API key", "HERMES_API_KEY", { required: true }),
      plain("agent_id", "Agent ID", "HERMES_AGENT_ID", "id"),
    ],
  },
  {
    id: "openclaw", tab: "agents", name: "OpenClaw", testable: true,
    description: "OpenClaw gateway.",
    fields: [
      plain("url", "URL", "OPENCLAW_URL", "url", { required: true }),
      secret("token", "Token", "OPENCLAW_TOKEN", { required: true }),
    ],
  },
  {
    id: "eve", tab: "agents", name: "Eve", testable: true,
    description: "Eve agent runtime.",
    fields: [
      plain("url", "URL", "EVE_URL", "url", { required: true }),
      secret("token", "Token", "EVE_TOKEN", { required: true }),
    ],
  },
  // ── Platform (status only — never stored in the dashboard) ──
  // ── Data feeds ──
  {
    id: "finnhub", tab: "data_feeds", name: "Finnhub (market data)", testable: true,
    description: "Stock quotes for the dashboard Markets, Dow, NASDAQ and ticker cards. The free plan covers the DIA, QQQ and SPY index funds.",
    docsUrl: "https://finnhub.io/dashboard",
    fields: [
      secret("api_key", "API key", "FINNHUB_API_KEY", { required: true, help: "Where to find it: finnhub.io → Dashboard → API key. Quotes refresh every minute while US markets are open." }),
    ],
  },
  {
    id: "platform_supabase", tab: "platform", name: "Supabase", managedInCoolify: true,
    description: "Needed to reach the database at all, and the service role key also signs dashboard action tokens.",
    fields: [
      plain("url", "Project URL", "NEXT_PUBLIC_SUPABASE_URL", "url", { help: "Where to find it: Supabase → Connect (top bar) → App Frameworks, or Project Settings → Data API → Project URL." }),
      plain("anon_key", "Publishable key (anon public)", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "text", { envAliases: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], help: "Where to find it: Project Settings → API Keys → Publishable key (legacy tab: anon public). Safe to expose; every browser receives it." }),
      secret("service_role_key", "Secret key (service_role)", "SUPABASE_SERVICE_ROLE_KEY", { help: "Where to find it: Project Settings → API Keys → Secret keys (legacy tab: service_role secret). Never expose." }),
      secret("database_url", "Direct connection string", "DATABASE_URL", { help: "Where to find it: Supabase → Connect (top bar) → Connection String → Direct connection (or Session pooler). Only used by local scripts (migrations, imports); the live app does not need it." }),
    ],
  },
  {
    id: "platform_secrets", tab: "platform", name: "App secrets", managedInCoolify: true,
    description: "Changing these breaks existing hashes, signatures or the encrypted store itself.",
    fields: [
      secret("credentials_master_key", "Credentials master key", "CREDENTIALS_MASTER_KEY", { help: "Encrypts everything on this page. Back it up — losing it means re-entering every key." }),
      secret("cron_secret", "Cron secret", "CRON_SECRET", { help: "SIG setting. Shared by the Coolify scheduled tasks (analytics, invitations, SMS campaigns)." }),
      secret("analytics_ip_salt", "Analytics IP salt", "ANALYTICS_IP_SALT"),
      secret("booking_hash_salt", "Booking hash salt", "BOOKING_HASH_SALT"),
    ],
  },
  {
    id: "platform_push", tab: "platform", name: "Web push (VAPID)", managedInCoolify: true,
    description: "Changing the key pair unsubscribes every device.",
    fields: [
      plain("public_key", "VAPID public key", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "text"),
      secret("private_key", "VAPID private key", "VAPID_PRIVATE_KEY"),
      plain("subject", "VAPID subject (mailto: or URL)", "VAPID_SUBJECT", "text"),
    ],
  },
  {
    id: "platform_mcp", tab: "platform", name: "MCP server", managedInCoolify: true,
    description: "AI connector (MCP) server settings.",
    fields: [
      plain("public_url", "Public URL", "MCP_PUBLIC_URL", "url"),
      plain("rate_per_min", "Rate limit per minute", "MCP_RATE_PER_MIN", "text"),
      plain("extra_redirect_uris", "Extra redirect URIs", "MCP_EXTRA_REDIRECT_URIS", "text"),
      plain("extra_redirect_hosts", "Extra redirect hosts", "MCP_EXTRA_REDIRECT_HOSTS", "text"),
    ],
  },
];

export const PROVIDER_MAP: Record<string, CatalogProvider> = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

/** Env var → (provider, field) for the static catalog, used by presence checks. */
export const ENV_INDEX: Record<string, { provider: string; field: string }> = (() => {
  const out: Record<string, { provider: string; field: string }> = {};
  for (const p of PROVIDERS) {
    if (p.managedInCoolify) continue;
    for (const f of p.fields) if (f.envVar && !out[f.envVar]) out[f.envVar] = { provider: p.id, field: f.key };
  }
  return out;
})();

export const CUSTOM_PREFIX = "custom:";
export const SOCIAL_PREFIX = "social:";
export const DEFINITION_FIELD = "__definition";

export function customProviderFrom(slug: string, def: CustomDefinition): CatalogProvider {
  return {
    id: `${CUSTOM_PREFIX}${slug}`,
    tab: "agents",
    name: def.name,
    description: def.description || "Custom provider.",
    custom: true,
    testable: Boolean(def.pingUrl),
    fields: def.fields.map((f) => ({ key: f.key, label: f.label, secret: f.secret, kind: f.secret ? "secret" : f.kind && f.kind !== "secret" ? f.kind : "text" })),
  };
}
