-- Site notices: the site-wide announcement bar (above the main nav on every
-- public page) and the Blog Sidebar Notification on /resources/<slug>.
-- Managed in Dashboard → Site Notices (and the MCP connector). Server-only: the
-- app reads/writes with the service role. The public site falls back to no bar
-- and the code default sidebar (lib/site-notices/shared.ts) until this runs.

-- ── Announcement bar ──────────────────────────────────────────────────────────
create table if not exists public.site_announcements (
  id           uuid primary key default gen_random_uuid(),
  message      text not null check (char_length(message) between 1 and 280),
  link_label   text check (link_label is null or char_length(link_label) <= 40),
  link_url     text check (link_url is null or char_length(link_url) <= 500),
  tone         text not null default 'navy' check (tone in ('navy', 'gold', 'alert')),
  enabled      boolean not null default true,
  dismissible  boolean not null default true,
  priority     integer not null default 0 check (priority between -100 and 100),
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint site_announcements_window check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists site_announcements_active_idx on public.site_announcements (enabled, ends_at, priority desc);
create index if not exists site_announcements_created_by_idx on public.site_announcements (created_by);
create index if not exists site_announcements_updated_by_idx on public.site_announcements (updated_by);

-- ── Keyed content blocks (blog sidebar notification, …) ──────────────────────
create table if not exists public.site_blocks (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  enabled     boolean not null default true,
  content     jsonb not null default '{}'::jsonb,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists site_blocks_updated_by_idx on public.site_blocks (updated_by);

-- ── updated_at triggers ───────────────────────────────────────────────────────
create or replace function public.set_site_notices_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_announcements_updated_at on public.site_announcements;
create trigger site_announcements_updated_at
  before update on public.site_announcements
  for each row execute function public.set_site_notices_updated_at();

drop trigger if exists site_blocks_updated_at on public.site_blocks;
create trigger site_blocks_updated_at
  before update on public.site_blocks
  for each row execute function public.set_site_notices_updated_at();

-- ── RLS: server-only ──────────────────────────────────────────────────────────
alter table public.site_announcements enable row level security;
alter table public.site_blocks enable row level security;
revoke all on table public.site_announcements from anon, authenticated;
revoke all on table public.site_blocks from anon, authenticated;
revoke execute on function public.set_site_notices_updated_at() from anon, authenticated, public;

-- ── Seed: default Blog Sidebar Notification (matches DEFAULT_BLOG_SIDEBAR) ────
insert into public.site_blocks (key, enabled, content)
values (
  'blog_sidebar',
  true,
  jsonb_build_object(
    'eyebrow', 'Year-end planning',
    'title', 'Questions before December 31?',
    'body', $t$Year-end is a good time to review required minimum distributions, charitable giving and retirement-plan contributions with your planner.

Our team is happy to help you decide what deserves attention before the calendar turns.$t$,
    'phone', '(480) 466-7070',
    'email', 'planning@strategicincomegroup.com',
    'hours', 'Mon. – Fri. 9:00 am to 5:00 pm',
    'show_offices', true,
    'cta_label', 'Contact us',
    'cta_url', '/contact'
  )
)
on conflict (key) do nothing;
