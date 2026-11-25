-- SIG Dashboard — customizable home (widgets, notifications feed, alerts, what's new, notepad).
--
-- * whats_new          product / firm updates posted by super admins from the dashboard
--                      ("Post update"). Per-user dismissals live in
--                      user_preferences.dashboard_preferences.whats_new_dismissed (no table).
-- * user_notepads      the Notepad widget's personal notes. RLS limits every user to their
--                      own rows; the app itself reads and writes with the service role.
-- * notifications      + severity (info | warning | critical) and category, which turn the
--                      existing notifications table into the Alerts feed as well.
--
-- The dashboard layout itself needs no table: it is stored per user in
-- user_preferences.dashboard_preferences.dashboard_layout.
--
-- whats_new is server-only: RLS on, nothing granted to anon/authenticated; the app reads
-- and writes it through guarded API routes (/api/dashboard/whats-new). The app tolerates
-- this migration not being applied yet (widgets show an empty state, notes stay unsaved
-- with a notice, alerts fall back to plain notifications). Idempotent — safe to re-run.

-- ── What's new ────────────────────────────────────────────────────────────────
create table if not exists public.whats_new (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 160),
  body          text not null default '' check (char_length(body) <= 5000),
  image_url     text check (image_url is null or char_length(image_url) <= 1000),
  link          text check (link is null or char_length(link) <= 1000),
  -- everyone | staff | admins
  audience      text not null default 'everyone' check (audience in ('everyone', 'staff', 'admins')),
  published_at  timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists whats_new_published_idx on public.whats_new (published_at desc);

alter table public.whats_new enable row level security;
revoke all on table public.whats_new from anon, authenticated;
grant select, insert, update, delete on table public.whats_new to service_role;

comment on table public.whats_new is
  'Dashboard "What''s new" updates, posted by super admins. Per-user dismissals are stored in user_preferences.dashboard_preferences.whats_new_dismissed. Service role only.';

-- ── Notepad ───────────────────────────────────────────────────────────────────
create table if not exists public.user_notepads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null default 'Notes' check (char_length(title) <= 120),
  body        text not null default '' check (char_length(body) <= 50000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists user_notepads_user_idx on public.user_notepads (user_id, updated_at desc);

alter table public.user_notepads enable row level security;

-- A profile's own rows only. profiles.id is the app user id; auth.uid() is the auth user,
-- linked through profiles.auth_user_id (older rows use the same id for both).
drop policy if exists "user_notepads_own_select" on public.user_notepads;
drop policy if exists "user_notepads_own_insert" on public.user_notepads;
drop policy if exists "user_notepads_own_update" on public.user_notepads;
drop policy if exists "user_notepads_own_delete" on public.user_notepads;

create policy "user_notepads_own_select" on public.user_notepads for select to authenticated
  using (user_id in (select p.id from public.profiles p where p.auth_user_id = (select auth.uid()) or p.id = (select auth.uid())));
create policy "user_notepads_own_insert" on public.user_notepads for insert to authenticated
  with check (user_id in (select p.id from public.profiles p where p.auth_user_id = (select auth.uid()) or p.id = (select auth.uid())));
create policy "user_notepads_own_update" on public.user_notepads for update to authenticated
  using (user_id in (select p.id from public.profiles p where p.auth_user_id = (select auth.uid()) or p.id = (select auth.uid())))
  with check (user_id in (select p.id from public.profiles p where p.auth_user_id = (select auth.uid()) or p.id = (select auth.uid())));
create policy "user_notepads_own_delete" on public.user_notepads for delete to authenticated
  using (user_id in (select p.id from public.profiles p where p.auth_user_id = (select auth.uid()) or p.id = (select auth.uid())));

revoke all on table public.user_notepads from anon;
grant select, insert, update, delete on table public.user_notepads to authenticated, service_role;

comment on table public.user_notepads is 'Dashboard Notepad widget — personal notes. RLS: own rows only.';

-- ── Alerts: severity + category on notifications ─────────────────────────────
alter table public.notifications add column if not exists severity text;
alter table public.notifications add column if not exists category text;

alter table public.notifications drop constraint if exists notifications_severity_check;
alter table public.notifications add constraint notifications_severity_check
  check (severity is null or severity in ('info', 'warning', 'critical'));
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category is null or category ~ '^[a-z][a-z0-9_]{0,39}$');

-- Alerts feed: a user's unread alerts, newest first.
create index if not exists notifications_user_alerts_idx
  on public.notifications (user_id, created_at desc)
  where severity is not null;
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

comment on column public.notifications.severity is 'Alert severity (info | warning | critical). NULL = an ordinary notification, not an alert.';
comment on column public.notifications.category is 'Alert / notification category, e.g. bookings, calls, sms, email, analytics, credentials.';
