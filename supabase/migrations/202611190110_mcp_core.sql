-- SIG MCP connector (Claude, ChatGPT, Gemini CLI, Grok/xAI): OAuth 2.1 for
-- MCP clients, personal API tokens, the MCP audit log, high-risk actions
-- waiting for confirmation, and the restorable trash.
--
-- Ported from CMI's mcp_core / mcp_safety migrations. Idempotent; safe to
-- re-run. Every table here is server-only: RLS on with no policies, and the
-- anon/authenticated roles have no grants, so only the service role (the
-- Next.js server via createSupabaseAdminClient) can read or write them.
-- Docs: docs/MCP_CONNECTOR.md.

-- ── OAuth clients (dynamic registration, RFC 7591) ─────────────────────────
create table if not exists public.mcp_oauth_clients (
  client_id                  text primary key,
  client_name                text,
  client_kind                text not null default 'other'
    check (client_kind in ('claude', 'chatgpt', 'gemini', 'grok', 'local', 'other')),
  redirect_uris              text[] not null default '{}',
  token_endpoint_auth_method text not null default 'none'
    check (token_endpoint_auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  client_secret_hash         text,              -- sha256; only for confidential clients
  client_uri                 text,
  software_id                text,
  created_at                 timestamptz not null default now()
);

-- ── Authorization codes: single use, 5 minutes, PKCE S256 required ─────────
create table if not exists public.mcp_oauth_codes (
  code_hash      text primary key,              -- sha256 of the code
  client_id      text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  code_challenge text not null,
  redirect_uri   text not null,
  scope          text,
  resource       text,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists mcp_oauth_codes_client_idx on public.mcp_oauth_codes (client_id);
create index if not exists mcp_oauth_codes_profile_idx on public.mcp_oauth_codes (profile_id);
create index if not exists mcp_oauth_codes_expires_idx on public.mcp_oauth_codes (expires_at);

-- ── Access + refresh tokens (only SHA-256 hashes are stored) ───────────────
create table if not exists public.mcp_oauth_tokens (
  id                 uuid primary key default gen_random_uuid(),
  token_hash         text not null unique,
  refresh_hash       text unique,
  client_id          text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  scope              text,
  expires_at         timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists mcp_oauth_tokens_profile_live_idx on public.mcp_oauth_tokens (profile_id, client_id) where revoked_at is null;
create index if not exists mcp_oauth_tokens_client_idx on public.mcp_oauth_tokens (client_id);

-- ── Personal API tokens (Grok/xAI API, scripts — clients without OAuth) ───
create table if not exists public.mcp_api_tokens (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  token_hash    text not null unique,           -- sha256 of the full token
  token_prefix  text not null,                  -- first characters, for display only
  allowed_tiers text[] not null default '{read}'
    check (allowed_tiers <@ array['read', 'write', 'high']::text[]),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists mcp_api_tokens_profile_idx on public.mcp_api_tokens (profile_id, created_at desc);

-- ── Audit: one row per MCP tool call ────────────────────────────────────────
create table if not exists public.mcp_audit_log (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references public.profiles(id) on delete set null,
  auth_kind       text check (auth_kind in ('oauth', 'api_token')),
  token_id        uuid,
  client_id       text,
  client_kind     text,
  client_name     text,
  tool            text not null,
  risk            text check (risk in ('read', 'write', 'high')),
  args            jsonb,                        -- redacted / truncated
  summary         text,
  success         boolean not null,
  error           text,
  duration_ms     integer,
  entity          text,
  record_id       text,
  before          jsonb,
  after           jsonb,
  confirmation_id uuid,
  created_at      timestamptz not null default now()
);
create index if not exists mcp_audit_log_created_idx on public.mcp_audit_log (created_at desc);
create index if not exists mcp_audit_log_profile_idx on public.mcp_audit_log (profile_id, created_at desc);
create index if not exists mcp_audit_log_record_idx on public.mcp_audit_log (entity, record_id) where record_id is not null;

-- ── High-risk actions waiting for sig_confirm (15 minutes) ────────────────
create table if not exists public.mcp_pending_actions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  token_id     uuid,
  client_id    text,
  client_kind  text,
  tool         text not null,
  args         jsonb not null default '{}',
  preview      jsonb not null default '{}',
  risk         text not null default 'high',
  status       text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'expired', 'failed')),
  expires_at   timestamptz not null default (now() + interval '15 minutes'),
  confirmed_at timestamptz,
  result       jsonb,
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists mcp_pending_actions_profile_idx on public.mcp_pending_actions (profile_id, status, created_at desc);

-- ── Trash: AI "delete" is always restorable ─────────────────────────────────
-- method = archive  → a timestamp column was set on the record
--          status   → a status value was set (previous status kept in snapshot)
--          snapshot → the row (and listed child rows) were copied here, then deleted
create table if not exists public.mcp_trash (
  id          uuid primary key default gen_random_uuid(),
  entity      text not null,
  record_id   text not null,
  label       text,
  method      text not null check (method in ('archive', 'status', 'snapshot')),
  snapshot    jsonb not null default '{}',
  deleted_by  uuid references public.profiles(id) on delete set null,
  deleted_via text not null default 'mcp' check (deleted_via in ('mcp', 'dashboard')),
  deleted_at  timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid references public.profiles(id) on delete set null
);
create index if not exists mcp_trash_open_idx on public.mcp_trash (deleted_at desc) where restored_at is null;
create index if not exists mcp_trash_record_idx on public.mcp_trash (entity, record_id);
create index if not exists mcp_trash_deleted_by_idx on public.mcp_trash (deleted_by);
create index if not exists mcp_trash_restored_by_idx on public.mcp_trash (restored_by);

-- ── RLS: server-only ────────────────────────────────────────────────────────
alter table public.mcp_oauth_clients   enable row level security;
alter table public.mcp_oauth_codes     enable row level security;
alter table public.mcp_oauth_tokens    enable row level security;
alter table public.mcp_api_tokens      enable row level security;
alter table public.mcp_audit_log       enable row level security;
alter table public.mcp_pending_actions enable row level security;
alter table public.mcp_trash           enable row level security;

revoke all on table
  public.mcp_oauth_clients, public.mcp_oauth_codes, public.mcp_oauth_tokens, public.mcp_api_tokens,
  public.mcp_audit_log, public.mcp_pending_actions, public.mcp_trash
from anon, authenticated;
