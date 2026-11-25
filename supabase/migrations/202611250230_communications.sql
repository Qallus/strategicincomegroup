-- SIG Communications — dialer settings, bulk SMS campaigns, phone-level opt-outs and
-- live call monitoring (listen / whisper / barge).
--
-- * communication_settings   one row (id = true). Super Admin edits it on the Dialer page:
--                            auto-transcribe recordings, Twilio Conference mode (needed for
--                            monitoring; OFF by default), bulk SMS throttle, keyword replies.
-- * sms_opt_outs             one row per phone (last 10 digits) that texted STOP. Covers
--                            numbers that match no profile / participant / contact, so a
--                            bulk send can never reach someone who opted out.
-- * sms_campaigns            a bulk SMS send (draft → scheduled → sending → done | cancelled).
-- * sms_campaign_recipients  the recipient snapshot taken when the campaign was created, with
--                            per-recipient delivery status from the Twilio status callback.
-- * call_monitor_sessions    an admin joining a live conference call as listen / whisper / barge.
-- * calls.conference_*       which Twilio Conference a call was routed through (Conference
--                            mode only) and the agent leg to coach.
--
-- Server-only: RLS on, nothing granted to anon/authenticated; the app reads and writes with
-- the service role through guarded API routes. The app tolerates this migration not being
-- applied (settings fall back to defaults: auto-transcribe off, Conference mode off; bulk
-- campaigns and monitoring show a "run the migration" notice).
-- Idempotent — safe to re-run.

-- ── Settings (single row) ─────────────────────────────────────────────────────
create table if not exists public.communication_settings (
  id                      boolean primary key default true check (id),
  auto_transcribe         boolean not null default false,
  voice_conference_mode   boolean not null default false,
  sms_messages_per_second numeric(5, 2) not null default 1 check (sms_messages_per_second > 0 and sms_messages_per_second <= 50),
  sms_keyword_replies     boolean not null default true,
  updated_by              uuid references public.profiles(id) on delete set null,
  updated_at              timestamptz not null default now()
);
insert into public.communication_settings (id) values (true) on conflict (id) do nothing;

comment on table public.communication_settings is
  'Dialer + SMS settings (single row). voice_conference_mode routes calls through Twilio Conferences so admins can monitor; OFF keeps the original Dial flow. Service role only.';

-- ── Phone-level opt-outs ─────────────────────────────────────────────────────
create table if not exists public.sms_opt_outs (
  phone_key     text primary key check (phone_key ~ '^[0-9]{4,15}$'),
  phone         text not null,
  source        text not null default 'keyword_stop',
  opted_out_at  timestamptz not null default now()
);

-- ── Bulk SMS campaigns ───────────────────────────────────────────────────────
create table if not exists public.sms_campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 200),
  body            text not null check (char_length(body) between 1 and 1600),
  status          text not null default 'draft'
                    check (status in ('draft', 'scheduled', 'sending', 'done', 'cancelled')),
  audience        jsonb not null default '{}'::jsonb,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  total_count     integer not null default 0,
  queued_count    integer not null default 0,
  sent_count      integer not null default 0,
  delivered_count integer not null default 0,
  failed_count    integer not null default 0,
  skipped_count   integer not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists sms_campaigns_status_idx on public.sms_campaigns (status, scheduled_at);
create index if not exists sms_campaigns_created_idx on public.sms_campaigns (created_at desc);

create table if not exists public.sms_campaign_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.sms_campaigns(id) on delete cascade,
  contact_id    uuid,
  contact_kind  text check (contact_kind is null or contact_kind in ('contact', 'participant', 'profile', 'manual')),
  name          text,
  phone         text not null,
  phone_key     text,
  merge_data    jsonb not null default '{}'::jsonb,
  body_rendered text,
  -- 'sending' is a short-lived claim so two queue runners never send the same row twice
  status        text not null default 'queued'
                  check (status in ('queued', 'sending', 'sent', 'delivered', 'failed', 'skipped_opt_out', 'skipped_invalid')),
  twilio_sid    text,
  error         text,
  sent_at       timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sms_campaign_recipients_campaign_idx on public.sms_campaign_recipients (campaign_id, status);
create index if not exists sms_campaign_recipients_sid_idx on public.sms_campaign_recipients (twilio_sid) where twilio_sid is not null;

-- ── Call monitoring ──────────────────────────────────────────────────────────
alter table public.calls add column if not exists conference_name text;
alter table public.calls add column if not exists conference_sid text;
alter table public.calls add column if not exists agent_call_sid text;
create index if not exists calls_conference_name_idx on public.calls (conference_name) where conference_name is not null;

create table if not exists public.call_monitor_sessions (
  id                  uuid primary key default gen_random_uuid(),
  call_id             uuid not null references public.calls(id) on delete cascade,
  conference_sid      text,
  conference_name     text,
  monitor_profile_id  uuid references public.profiles(id) on delete set null,
  monitor_call_sid    text,
  mode                text not null default 'listen' check (mode in ('listen', 'whisper', 'barge')),
  started_at          timestamptz not null default now(),
  ended_at            timestamptz
);
create index if not exists call_monitor_sessions_call_idx on public.call_monitor_sessions (call_id);
create index if not exists call_monitor_sessions_started_idx on public.call_monitor_sessions (started_at desc);

-- ── RLS: server-only ─────────────────────────────────────────────────────────
alter table public.communication_settings  enable row level security;
alter table public.sms_opt_outs            enable row level security;
alter table public.sms_campaigns           enable row level security;
alter table public.sms_campaign_recipients enable row level security;
alter table public.call_monitor_sessions   enable row level security;

revoke all on table public.communication_settings  from anon, authenticated;
revoke all on table public.sms_opt_outs            from anon, authenticated;
revoke all on table public.sms_campaigns           from anon, authenticated;
revoke all on table public.sms_campaign_recipients from anon, authenticated;
revoke all on table public.call_monitor_sessions   from anon, authenticated;

grant select, insert, update, delete on table public.communication_settings  to service_role;
grant select, insert, update, delete on table public.sms_opt_outs            to service_role;
grant select, insert, update, delete on table public.sms_campaigns           to service_role;
grant select, insert, update, delete on table public.sms_campaign_recipients to service_role;
grant select, insert, update, delete on table public.call_monitor_sessions   to service_role;

-- Backfill: every number already opted out on a profile / participant becomes a phone-level
-- opt-out too, so the first bulk campaign honours them even if the record is later edited.
insert into public.sms_opt_outs (phone_key, phone, source, opted_out_at)
select distinct on (k) k, phone, 'backfill', coalesce(sms_opt_out_at, now())
from (
  select right(regexp_replace(phone, '\D', '', 'g'), 10) as k, phone, sms_opt_out_at
    from public.profiles where sms_opt_in = false and phone is not null
  union all
  select right(regexp_replace(phone, '\D', '', 'g'), 10), phone, sms_opt_out_at
    from public.participants where sms_opt_in = false and phone is not null
) s
where k ~ '^[0-9]{4,15}$'
on conflict (phone_key) do nothing;
