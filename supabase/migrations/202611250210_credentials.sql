-- SIG Credentials — encrypted key manager (Dashboard → Credentials, Super Admin only).
--
-- * credentials        one row per (provider, instance, field). Secret values are
--                      AES-256-GCM ciphertext produced IN THE APP (lib/credentials/crypto.ts)
--                      with CREDENTIALS_MASTER_KEY, which lives only in Coolify. The
--                      database never sees a readable secret, and nothing here depends on
--                      a Postgres extension. Non-secret values (URLs, IDs, model names)
--                      are kept in plain_value and shown in full on the page.
-- * credential_tests   latest "Test connection" result per (provider, instance).
--
-- Custom providers ("Agents & harnesses" → Custom provider) store their definition as a
-- row with provider = 'custom:<slug>' and field = '__definition' (plain_value = JSON).
-- Connected social accounts use provider = 'social:<platform>', instance = the
-- social_accounts.id.
--
-- Server-only: RLS on, nothing granted to anon/authenticated; the app reads and writes
-- with the service role. Neither table is in Siggy's SQL table hints, and the Siggy
-- read-only SQL tool refuses queries that reference them. The app tolerates this
-- migration not being applied yet (every feature keeps reading the Coolify env vars).
-- Idempotent — safe to re-run.

-- ── Values ────────────────────────────────────────────────────────────────────
create table if not exists public.credentials (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null check (provider ~ '^[a-z0-9][a-z0-9_:.-]{0,99}$'),
  instance     text not null default 'default' check (char_length(instance) between 1 and 100),
  field        text not null check (field ~ '^[a-z0-9_]{1,64}$'),
  is_secret    boolean not null default true,
  -- secret values (base64): AES-256-GCM ciphertext, 12-byte IV, 16-byte auth tag
  ciphertext   text,
  iv           text,
  auth_tag     text,
  key_version  smallint,
  last4        text check (last4 is null or char_length(last4) <= 4),
  -- non-secret values
  plain_value  text check (plain_value is null or char_length(plain_value) <= 20000),
  created_by   uuid references public.profiles(id) on delete set null,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint credentials_provider_instance_field_key unique (provider, instance, field),
  -- a secret row carries ciphertext and never a plain value; a plain row the reverse
  constraint credentials_secret_shape check (
    (is_secret and ciphertext is not null and iv is not null and auth_tag is not null and key_version is not null and plain_value is null)
    or
    (not is_secret and plain_value is not null and ciphertext is null and iv is null and auth_tag is null and last4 is null)
  )
);
create index if not exists credentials_provider_idx on public.credentials(provider, instance);

-- ── Connection tests ──────────────────────────────────────────────────────────
create table if not exists public.credential_tests (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null,
  instance   text not null default 'default',
  ok         boolean not null,
  message    text check (message is null or char_length(message) <= 500),
  tested_at  timestamptz not null default now(),
  tested_by  uuid references public.profiles(id) on delete set null,
  constraint credential_tests_provider_instance_key unique (provider, instance)
);

-- ── RLS: server-only ──────────────────────────────────────────────────────────
alter table public.credentials      enable row level security;
alter table public.credential_tests enable row level security;

revoke all on table public.credentials      from anon, authenticated;
revoke all on table public.credential_tests from anon, authenticated;

grant select, insert, update, delete on table public.credentials      to service_role;
grant select, insert, update, delete on table public.credential_tests to service_role;

comment on table public.credentials is
  'SIG Credentials (Dashboard → Credentials). Secret values are AES-256-GCM ciphertext encrypted in the app with CREDENTIALS_MASTER_KEY; never readable from SQL. Service role only.';

-- ── Social accounts: plain-text tokens move into the encrypted store ─────────
-- social_accounts.credentials used to hold platform tokens as plain text. Encryption
-- happens in the app (the database never has the master key), so the move is a
-- one-time app step, not SQL:
--
--   1. Set CREDENTIALS_MASTER_KEY in Coolify and redeploy.
--   2. Run this migration.
--   3. Dashboard → Credentials → Social → "Encrypt saved social tokens"
--      (POST /api/admin/credentials/migrate-social). For each account it encrypts every
--      value into public.credentials (provider 'social:<platform>', instance = account
--      id) and only then clears that account's social_accounts.credentials to '{}'.
--
-- From then on the app never writes social_accounts.credentials again. Check it is
-- empty everywhere with:
--   select id, platform from public.social_accounts where credentials <> '{}'::jsonb;
comment on column public.social_accounts.credentials is
  'DEPRECATED — tokens now live encrypted in public.credentials (provider social:<platform>, instance = this id). Kept empty; cleared by the one-time move on the Credentials page.';
