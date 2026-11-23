-- SIG Analytics — Phase 1 foundation (plus the empty Phase 2–4 tables so later
-- phases need no schema churn).
--
-- * analytics_events      raw first-party events from the cookieless site beacon (/api/t)
-- * analytics_daily       daily rollups by (day, path, channel); dashboard charts read these
-- * analytics_bot_hits    AI-crawler / search-bot page hits logged by middleware
-- * analytics_sync_runs   one row per cron / source sync run (Connections panel)
-- * analytics_search_daily, analytics_gbp_daily, email_events, link_redirects,
--   link_clicks, siggy_questions — written from Phase 2 onwards
-- * first_touch / last_touch / landing_path / session_id on form_submissions,
--   bookings, event_registrations and contacts
--
-- Privacy: no IP addresses, user agents, names or contact details are stored in any
-- analytics table. visitor_hash is a truncated SHA-256 of a daily-rotating salt +
-- IP + UA, so it cannot be reversed or linked across days.
--
-- Server-only: RLS on, nothing granted to anon/authenticated; the app reads and
-- writes with the service role. The app tolerates this migration not being applied
-- yet (empty states / silent 204s). Idempotent — safe to re-run.
--
-- "Day" means the America/Phoenix calendar day (Arizona has no DST).

-- ── Shared channel list ───────────────────────────────────────────────────────
-- organic_search · ai_assistant · social · email · sms · business_card · paid ·
-- referral · direct   (lib/analytics/channels.ts must stay in sync)

-- ── Raw events ────────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  event          text not null check (event ~ '^[a-z_]{2,40}$'),
  path           text not null check (char_length(path) between 1 and 500),
  title          text check (title is null or char_length(title) <= 300),
  referrer_host  text check (referrer_host is null or char_length(referrer_host) <= 255),
  channel        text not null default 'direct' check (channel in ('organic_search','ai_assistant','social','email','sms','business_card','paid','referral','direct')),
  source         text check (source is null or char_length(source) <= 120),
  utm_source     text check (utm_source is null or char_length(utm_source) <= 120),
  utm_medium     text check (utm_medium is null or char_length(utm_medium) <= 120),
  utm_campaign   text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  utm_content    text check (utm_content is null or char_length(utm_content) <= 200),
  utm_term       text check (utm_term is null or char_length(utm_term) <= 200),
  session_id     text check (session_id is null or session_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  visitor_hash   text check (visitor_hash is null or visitor_hash ~ '^[a-f0-9]{8,64}$'),
  device         text check (device is null or device in ('desktop','mobile','tablet','other')),
  browser        text check (browser is null or char_length(browser) <= 40),
  country        text check (country is null or country ~ '^[A-Z]{2}$'),
  region         text check (region is null or char_length(region) <= 80),
  engaged_ms     integer check (engaged_ms is null or engaged_ms between 0 and 86400000),
  scroll_depth   smallint check (scroll_depth is null or scroll_depth between 0 and 100),
  props          jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 4096)
);

create index if not exists analytics_events_occurred_idx on public.analytics_events (occurred_at);
create index if not exists analytics_events_path_idx on public.analytics_events (path, occurred_at);
create index if not exists analytics_events_channel_idx on public.analytics_events (channel, occurred_at);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id) where session_id is not null;

-- ── Daily rollups ─────────────────────────────────────────────────────────────
-- path '*' = all pages for that channel; channel '*' = all channels. The (day,'*','*')
-- row holds the day's de-duplicated totals.
create table if not exists public.analytics_daily (
  day               date not null,
  path              text not null check (char_length(path) between 1 and 500),
  channel           text not null check (channel in ('*','organic_search','ai_assistant','social','email','sms','business_card','paid','referral','direct')),
  views             integer not null default 0 check (views >= 0),
  visitors          integer not null default 0 check (visitors >= 0),
  sessions          integer not null default 0 check (sessions >= 0),
  engaged_sessions  integer not null default 0 check (engaged_sessions >= 0),
  engaged_ms        bigint  not null default 0 check (engaged_ms >= 0),
  leads             integer not null default 0 check (leads >= 0),
  bookings          integer not null default 0 check (bookings >= 0),
  registrations     integer not null default 0 check (registrations >= 0),
  conversions       integer not null default 0 check (conversions >= 0),
  updated_at        timestamptz not null default now(),
  primary key (day, path, channel)
);

create index if not exists analytics_daily_channel_idx on public.analytics_daily (channel, day);

-- ── Bot / AI crawler hits ─────────────────────────────────────────────────────
create table if not exists public.analytics_bot_hits (
  day           date not null,
  bot           text not null check (char_length(bot) between 1 and 60),
  path          text not null check (char_length(path) between 1 and 500),
  hits          integer not null default 0 check (hits >= 0),
  last_seen_at  timestamptz not null default now(),
  primary key (day, bot, path)
);

create index if not exists analytics_bot_hits_bot_idx on public.analytics_bot_hits (bot, day);

-- ── Sync runs (cron + source syncs) ───────────────────────────────────────────
create table if not exists public.analytics_sync_runs (
  id           uuid primary key default gen_random_uuid(),
  source       text not null check (source ~ '^[a-z0-9_]{2,40}$'),
  mode         text check (mode is null or char_length(mode) <= 40),
  status       text not null default 'running' check (status in ('running','ok','error','skipped')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  row_count    integer check (row_count is null or row_count >= 0),
  error        text check (error is null or char_length(error) <= 2000),
  details      jsonb not null default '{}'::jsonb
);

create index if not exists analytics_sync_runs_source_idx on public.analytics_sync_runs (source, started_at desc);

-- ── Phase 2: Google Search Console ────────────────────────────────────────────
create table if not exists public.analytics_search_daily (
  day          date not null,
  page         text not null check (char_length(page) <= 1000),
  query        text not null check (char_length(query) <= 500),
  clicks       integer not null default 0 check (clicks >= 0),
  impressions  integer not null default 0 check (impressions >= 0),
  ctr          numeric(6,4),
  position     numeric(7,2),
  updated_at   timestamptz not null default now(),
  primary key (day, page, query)
);

create index if not exists analytics_search_daily_query_idx on public.analytics_search_daily (query, day);

-- ── Phase 2: Google Business Profile ──────────────────────────────────────────
create table if not exists public.analytics_gbp_daily (
  day          date not null,
  location_id  text not null check (char_length(location_id) <= 120),
  metric       text not null check (metric ~ '^[A-Za-z0-9_]{2,80}$'),
  value        bigint not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (day, location_id, metric)
);

-- ── Phase 3: email events (Resend webhooks) ───────────────────────────────────
create table if not exists public.email_events (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null default 'resend' check (char_length(provider) <= 40),
  provider_event_id    text check (provider_event_id is null or char_length(provider_event_id) <= 200),
  provider_message_id  text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  send_log_id          uuid references public.email_send_logs(id) on delete set null,
  event_type           text not null check (event_type in ('sent','delivered','delivery_delayed','opened','clicked','bounced','complained','failed','unsubscribed')),
  link_url             text check (link_url is null or char_length(link_url) <= 2000),
  template_key         text check (template_key is null or char_length(template_key) <= 120),
  campaign             text check (campaign is null or char_length(campaign) <= 200),
  occurred_at          timestamptz not null default now(),
  payload              jsonb not null default '{}'::jsonb,
  unique (provider, provider_event_id)
);

create index if not exists email_events_message_idx on public.email_events (provider_message_id);
create index if not exists email_events_send_log_idx on public.email_events (send_log_id);
create index if not exists email_events_type_idx on public.email_events (event_type, occurred_at);

-- ── Phase 3: short links ──────────────────────────────────────────────────────
create table if not exists public.link_redirects (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Za-z0-9_-]{2,40}$'),
  target_url    text not null check (char_length(target_url) between 1 and 2000),
  label         text check (label is null or char_length(label) <= 200),
  channel       text check (channel is null or channel in ('organic_search','ai_assistant','social','email','sms','business_card','paid','referral','direct')),
  utm_source    text check (utm_source is null or char_length(utm_source) <= 120),
  utm_medium    text check (utm_medium is null or char_length(utm_medium) <= 120),
  utm_campaign  text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  active        boolean not null default true,
  expires_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists link_redirects_created_by_idx on public.link_redirects (created_by);

create table if not exists public.link_clicks (
  id             bigint generated always as identity primary key,
  link_id        uuid not null references public.link_redirects(id) on delete cascade,
  occurred_at    timestamptz not null default now(),
  visitor_hash   text check (visitor_hash is null or visitor_hash ~ '^[a-f0-9]{8,64}$'),
  device         text check (device is null or device in ('desktop','mobile','tablet','other')),
  country        text check (country is null or country ~ '^[A-Z]{2}$'),
  referrer_host  text check (referrer_host is null or char_length(referrer_host) <= 255)
);

create index if not exists link_clicks_link_idx on public.link_clicks (link_id, occurred_at);
create index if not exists link_clicks_occurred_idx on public.link_clicks (occurred_at);

-- ── Phase 4: Siggy question log (no names or contact details) ─────────────────
create table if not exists public.siggy_questions (
  id              bigint generated always as identity primary key,
  asked_at        timestamptz not null default now(),
  question        text not null check (char_length(question) between 1 and 500),
  matched         boolean not null default false,
  matched_answer  text check (matched_answer is null or char_length(matched_answer) <= 200),
  score           numeric(6,3),
  path            text check (path is null or char_length(path) <= 500),
  session_id      text check (session_id is null or session_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  follow_up       text check (follow_up is null or char_length(follow_up) <= 500)
);

create index if not exists siggy_questions_asked_idx on public.siggy_questions (asked_at);
create index if not exists siggy_questions_unmatched_idx on public.siggy_questions (asked_at) where not matched;

-- ── Attribution columns on conversions ────────────────────────────────────────
alter table public.form_submissions    add column if not exists first_touch  jsonb;
alter table public.form_submissions    add column if not exists last_touch   jsonb;
alter table public.form_submissions    add column if not exists landing_path text;
alter table public.form_submissions    add column if not exists session_id   text;

alter table public.bookings            add column if not exists first_touch  jsonb;
alter table public.bookings            add column if not exists last_touch   jsonb;
alter table public.bookings            add column if not exists landing_path text;
alter table public.bookings            add column if not exists session_id   text;

alter table public.event_registrations add column if not exists first_touch  jsonb;
alter table public.event_registrations add column if not exists last_touch   jsonb;
alter table public.event_registrations add column if not exists landing_path text;
alter table public.event_registrations add column if not exists session_id   text;

alter table public.contacts            add column if not exists first_touch  jsonb;
alter table public.contacts            add column if not exists last_touch   jsonb;
alter table public.contacts            add column if not exists landing_path text;
alter table public.contacts            add column if not exists session_id   text;

create index if not exists form_submissions_created_idx    on public.form_submissions (created_at);
create index if not exists bookings_created_idx            on public.bookings (created_at);
create index if not exists event_registrations_created_idx on public.event_registrations (created_at);

-- ── Bot hit counter (atomic upsert, called by /api/t/bot) ─────────────────────
create or replace function public.analytics_bot_hit(p_bot text, p_path text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.analytics_bot_hits (day, bot, path, hits, last_seen_at)
  values ((now() at time zone 'America/Phoenix')::date, left(p_bot, 60), left(p_path, 500), 1, now())
  on conflict (day, bot, path)
  do update set hits = public.analytics_bot_hits.hits + 1, last_seen_at = excluded.last_seen_at;
$$;

-- ── Daily rollup: rebuilds analytics_daily for one Arizona day ────────────────
-- Engaged session = 2+ page views, or 10s+ of engaged time.
-- Conversions come from the four conversion tables by last_touch->>'channel'
-- (default 'direct'); card leads count under business_card. Staff-made bookings
-- (source 'mcp') and contacts without web attribution are not website conversions.
create or replace function public.analytics_rollup(p_day date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from timestamptz := (p_day::timestamp at time zone 'America/Phoenix');
  v_to   timestamptz := ((p_day + 1)::timestamp at time zone 'America/Phoenix');
  v_rows integer;
begin
  delete from public.analytics_daily where day = p_day;

  with ev as (
    select * from public.analytics_events where occurred_at >= v_from and occurred_at < v_to
  ),
  sess as (
    select session_id,
           (count(*) filter (where event = 'page_view') >= 2 or coalesce(sum(engaged_ms), 0) >= 10000) as engaged
    from ev where session_id is not null group by session_id
  ),
  conv as (
    select coalesce(nullif(landing_path, ''), '(unknown)') as path, coalesce(last_touch->>'channel', 'direct') as channel,
           1 as leads, 0 as bookings, 0 as registrations
      from public.form_submissions where created_at >= v_from and created_at < v_to and deleted_at is null
    union all
    select coalesce(nullif(landing_path, ''), '(unknown)'), coalesce(last_touch->>'channel', 'direct'), 0, 1, 0
      from public.bookings where created_at >= v_from and created_at < v_to and coalesce(source, '') <> 'mcp'
    union all
    select coalesce(nullif(landing_path, ''), '(unknown)'), coalesce(last_touch->>'channel', 'direct'), 0, 0, 1
      from public.event_registrations where created_at >= v_from and created_at < v_to
    union all
    select coalesce(nullif(landing_path, ''), '(unknown)'), coalesce(last_touch->>'channel', 'direct'), 1, 0, 0
      from public.contacts where created_at >= v_from and created_at < v_to and last_touch is not null
    union all
    select '/c', 'business_card', 1, 0, 0
      from public.business_card_leads where created_at >= v_from and created_at < v_to
  ),
  conv_clean as (
    select path,
           case when channel in ('organic_search','ai_assistant','social','email','sms','business_card','paid','referral','direct') then channel else 'direct' end as channel,
           leads, bookings, registrations
    from conv
  ),
  traffic as (
    -- per page + channel
    select e.path, e.channel,
           count(*) filter (where e.event = 'page_view') as views,
           count(distinct e.visitor_hash) filter (where e.event = 'page_view') as visitors,
           count(distinct e.session_id) filter (where e.event = 'page_view') as sessions,
           count(distinct e.session_id) filter (where e.event = 'page_view' and s.engaged) as engaged_sessions,
           coalesce(sum(e.engaged_ms), 0) as engaged_ms
    from ev e left join sess s using (session_id)
    group by e.path, e.channel
    union all
    -- all pages, per channel
    select '*', e.channel,
           count(*) filter (where e.event = 'page_view'),
           count(distinct e.visitor_hash) filter (where e.event = 'page_view'),
           count(distinct e.session_id) filter (where e.event = 'page_view'),
           count(distinct e.session_id) filter (where e.event = 'page_view' and s.engaged),
           coalesce(sum(e.engaged_ms), 0)
    from ev e left join sess s using (session_id)
    group by e.channel
    union all
    -- whole site
    select '*', '*',
           count(*) filter (where e.event = 'page_view'),
           count(distinct e.visitor_hash) filter (where e.event = 'page_view'),
           count(distinct e.session_id) filter (where e.event = 'page_view'),
           count(distinct e.session_id) filter (where e.event = 'page_view' and s.engaged),
           coalesce(sum(e.engaged_ms), 0)
    from ev e left join sess s using (session_id)
    having count(*) > 0
  ),
  conversions as (
    select path, channel, sum(leads) leads, sum(bookings) bookings, sum(registrations) registrations from conv_clean group by path, channel
    union all
    select '*', channel, sum(leads), sum(bookings), sum(registrations) from conv_clean group by channel
    union all
    select '*', '*', sum(leads), sum(bookings), sum(registrations) from conv_clean having count(*) > 0
  ),
  merged as (
    select path, channel, views, visitors, sessions, engaged_sessions, engaged_ms, 0::bigint leads, 0::bigint bookings, 0::bigint registrations from traffic
    union all
    select path, channel, 0, 0, 0, 0, 0, leads, bookings, registrations from conversions
  )
  insert into public.analytics_daily (day, path, channel, views, visitors, sessions, engaged_sessions, engaged_ms, leads, bookings, registrations, conversions, updated_at)
  select p_day, left(path, 500), channel,
         sum(views)::int, sum(visitors)::int, sum(sessions)::int, sum(engaged_sessions)::int, sum(engaged_ms)::bigint,
         sum(leads)::int, sum(bookings)::int, sum(registrations)::int, (sum(leads) + sum(bookings) + sum(registrations))::int, now()
  from merged
  group by path, channel;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ── Retention: raw analytics older than 13 months ─────────────────────────────
create or replace function public.analytics_purge(p_months integer default 13)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - make_interval(months => greatest(p_months, 1));
  v_total integer := 0;
  v_n integer;
begin
  delete from public.analytics_events where occurred_at < v_cutoff;
  get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.link_clicks where occurred_at < v_cutoff;
  get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.analytics_bot_hits where day < (v_cutoff at time zone 'America/Phoenix')::date;
  get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.siggy_questions where asked_at < v_cutoff;
  get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.analytics_sync_runs where started_at < v_cutoff;
  get diagnostics v_n = row_count; v_total := v_total + v_n;
  return v_total;
end;
$$;

-- ── Dashboard report: one jsonb document for a date range ─────────────────────
-- Returned as a single value so PostgREST's row cap never truncates a long range.
-- Charts read analytics_daily; campaign / AI / click breakdowns read raw events.
create or replace function public.analytics_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone 'America/Phoenix');
  v_to   timestamptz := ((p_to + 1)::timestamp at time zone 'America/Phoenix');
  v jsonb;
begin
  with d as (
    select * from public.analytics_daily where day between p_from and p_to
  ),
  ev as (
    select * from public.analytics_events where occurred_at >= v_from and occurred_at < v_to
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'views', coalesce(sum(views), 0), 'visitors', coalesce(sum(visitors), 0), 'sessions', coalesce(sum(sessions), 0),
        'engaged_sessions', coalesce(sum(engaged_sessions), 0), 'engaged_ms', coalesce(sum(engaged_ms), 0),
        'leads', coalesce(sum(leads), 0), 'bookings', coalesce(sum(bookings), 0), 'registrations', coalesce(sum(registrations), 0),
        'conversions', coalesce(sum(conversions), 0), 'days_with_data', count(*) filter (where views > 0))
      from d where path = '*' and channel = '*'
    ),
    'channels', coalesce((
      select jsonb_agg(c order by c.visitors desc, c.conversions desc) from (
        select channel, sum(views)::int views, sum(visitors)::int visitors, sum(sessions)::int sessions, sum(engaged_sessions)::int engaged_sessions,
               sum(engaged_ms)::bigint engaged_ms, sum(leads)::int leads, sum(bookings)::int bookings, sum(registrations)::int registrations, sum(conversions)::int conversions
        from d where path = '*' and channel <> '*' group by channel
      ) c
    ), '[]'::jsonb),
    'trend', coalesce((
      select jsonb_agg(t order by t.day, t.channel) from (
        select day, channel, visitors, views, sessions, engaged_sessions, conversions from d where path = '*'
      ) t
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(pg order by pg.views desc) from (
        select path, sum(views)::int views, sum(visitors)::int visitors, sum(sessions)::int sessions, sum(engaged_sessions)::int engaged_sessions,
               sum(engaged_ms)::bigint engaged_ms, sum(conversions)::int conversions
        from d where path <> '*' and channel <> '*' group by path order by sum(views) desc, sum(conversions) desc limit 200
      ) pg
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(cp order by cp.sessions desc) from (
        select utm_campaign campaign, coalesce(utm_source, '') source, coalesce(utm_medium, '') medium, channel,
               count(distinct session_id)::int sessions, count(*)::int views
        from ev where event = 'page_view' and utm_campaign is not null
        group by utm_campaign, utm_source, utm_medium, channel order by count(distinct session_id) desc limit 100
      ) cp
    ), '[]'::jsonb),
    'campaign_conversions', coalesce((
      select jsonb_agg(cc) from (
        select campaign, count(*)::int conversions from (
          select last_touch->>'campaign' campaign from public.form_submissions where created_at >= v_from and created_at < v_to and deleted_at is null
          union all select last_touch->>'campaign' from public.bookings where created_at >= v_from and created_at < v_to and coalesce(source, '') <> 'mcp'
          union all select last_touch->>'campaign' from public.event_registrations where created_at >= v_from and created_at < v_to
        ) x where campaign is not null group by campaign
      ) cc
    ), '[]'::jsonb),
    'ai_sources', coalesce((
      select jsonb_agg(a order by a.sessions desc) from (
        select coalesce(source, referrer_host, 'Unknown') source, count(distinct session_id)::int sessions, count(distinct visitor_hash)::int visitors, count(*)::int views
        from ev where event = 'page_view' and channel = 'ai_assistant' group by 1
      ) a
    ), '[]'::jsonb),
    'ai_pages', coalesce((
      select jsonb_agg(a order by a.sessions desc) from (
        select path, coalesce(source, referrer_host, 'Unknown') source, count(distinct session_id)::int sessions, count(*)::int views
        from ev where event = 'page_view' and channel = 'ai_assistant' group by 1, 2 order by count(distinct session_id) desc limit 50
      ) a
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(r order by r.sessions desc) from (
        select referrer_host host, channel, count(distinct session_id)::int sessions, count(*)::int views
        from ev where event = 'page_view' and referrer_host is not null group by 1, 2 order by count(distinct session_id) desc limit 50
      ) r
    ), '[]'::jsonb),
    'clicks', coalesce((
      select jsonb_agg(k) from (
        select event, count(*)::int clicks from ev where event like 'click\_%' group by event
      ) k
    ), '[]'::jsonb),
    'outbound', coalesce((
      select jsonb_agg(o order by o.clicks desc) from (
        select props->>'target' target, count(*)::int clicks from ev where event = 'click_outbound' and props ? 'target'
        group by 1 order by count(*) desc limit 25
      ) o
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(dv order by dv.sessions desc) from (
        select coalesce(device, 'other') device, count(distinct session_id)::int sessions from ev where event = 'page_view' group by 1
      ) dv
    ), '[]'::jsonb),
    'page_engagement', coalesce((
      select jsonb_agg(pe) from (
        select path, round(avg(scroll_depth))::int avg_scroll, round(avg(engaged_ms))::int avg_engaged_ms, count(*)::int samples
        from ev where event = 'engagement' group by path order by count(*) desc limit 200
      ) pe
    ), '[]'::jsonb),
    'bots', coalesce((
      select jsonb_agg(b order by b.hits desc) from (
        select bot, sum(hits)::int hits, count(distinct path)::int pages, max(last_seen_at) last_seen_at
        from public.analytics_bot_hits where day between p_from and p_to group by bot
      ) b
    ), '[]'::jsonb),
    'bot_pages', coalesce((
      select jsonb_agg(b order by b.hits desc) from (
        select path, sum(hits)::int hits, count(distinct bot)::int bots, string_agg(distinct bot, ', ') bot_names
        from public.analytics_bot_hits where day between p_from and p_to group by path order by sum(hits) desc limit 50
      ) b
    ), '[]'::jsonb),
    'bot_trend', coalesce((
      select jsonb_agg(b order by b.day) from (
        select day, bot, sum(hits)::int hits from public.analytics_bot_hits where day between p_from and p_to group by day, bot
      ) b
    ), '[]'::jsonb),
    'last_event_at', (select max(occurred_at) from public.analytics_events where occurred_at > now() - interval '30 days'),
    'last_rollup_at', (select max(updated_at) from public.analytics_daily)
  ) into v;
  return v;
end;
$$;

-- ── RLS: server-only ──────────────────────────────────────────────────────────
alter table public.analytics_events       enable row level security;
alter table public.analytics_daily        enable row level security;
alter table public.analytics_bot_hits     enable row level security;
alter table public.analytics_sync_runs    enable row level security;
alter table public.analytics_search_daily enable row level security;
alter table public.analytics_gbp_daily    enable row level security;
alter table public.email_events           enable row level security;
alter table public.link_redirects         enable row level security;
alter table public.link_clicks            enable row level security;
alter table public.siggy_questions        enable row level security;

revoke all on table public.analytics_events       from anon, authenticated;
revoke all on table public.analytics_daily        from anon, authenticated;
revoke all on table public.analytics_bot_hits     from anon, authenticated;
revoke all on table public.analytics_sync_runs    from anon, authenticated;
revoke all on table public.analytics_search_daily from anon, authenticated;
revoke all on table public.analytics_gbp_daily    from anon, authenticated;
revoke all on table public.email_events           from anon, authenticated;
revoke all on table public.link_redirects         from anon, authenticated;
revoke all on table public.link_clicks            from anon, authenticated;
revoke all on table public.siggy_questions        from anon, authenticated;

revoke execute on function public.analytics_bot_hit(text, text) from public, anon, authenticated;
revoke execute on function public.analytics_rollup(date)        from public, anon, authenticated;
revoke execute on function public.analytics_purge(integer)      from public, anon, authenticated;
revoke execute on function public.analytics_report(date, date)  from public, anon, authenticated;
grant execute on function public.analytics_bot_hit(text, text) to service_role;
grant execute on function public.analytics_rollup(date)        to service_role;
grant execute on function public.analytics_purge(integer)      to service_role;
grant execute on function public.analytics_report(date, date)  to service_role;
