-- Booking self-service (manage / reschedule / cancel) + planner linking.
--
--  1. bookings: a per-booking manage token (only its SHA-256 is stored), reschedule /
--     cancel bookkeeping, and an index for "find my appointments by email".
--  2. booking_access_requests: one-hour, single-use "email me my appointments" links.
--     Server-only (service role); anon/authenticated have no access.
--  3. Planner linking: booking pages and bookings belong to the planner's dashboard
--     login (profiles.id) — resolved from booking_types.host_slug → employee_profiles.slug
--     → employee_profiles.profile_id. employee_profiles.profile_id is linked automatically
--     when a dashboard profile's email matches employee_profiles.account_email.
--  4. booking_reschedule(): atomic move with a conflict re-check under a lock.
--  5. One-time backfill.
--
-- Safe to run more than once. The app keeps working before this runs (it retries
-- without the new columns and falls back to a non-locking reschedule).

-- ── 1. bookings ──────────────────────────────────────────────────────────────────
alter table public.bookings add column if not exists manage_token_hash text;
alter table public.bookings add column if not exists manage_token_created_at timestamptz;
alter table public.bookings add column if not exists rescheduled_at timestamptz;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists cancelled_by text;
-- ICS SEQUENCE: bumped on every reschedule / cancel so calendar apps update in place.
alter table public.bookings add column if not exists ics_sequence integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_manage_token_hash_key') then
    alter table public.bookings add constraint bookings_manage_token_hash_key unique (manage_token_hash);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_cancelled_by_check') then
    alter table public.bookings add constraint bookings_cancelled_by_check
      check (cancelled_by is null or cancelled_by in ('client', 'staff'));
  end if;
end $$;

create index if not exists bookings_invitee_email_lower_idx on public.bookings (lower(invitee_email));
create index if not exists bookings_host_start_idx on public.bookings (host_staff_id, start_at);
create index if not exists bookings_type_start_idx on public.bookings (booking_type_id, start_at);

comment on column public.bookings.manage_token_hash is 'SHA-256 (hex) of the client''s manage-link token. The raw token is never stored.';
comment on column public.bookings.cancelled_by is 'Who cancelled: client (self-service link) or staff (dashboard / MCP).';
comment on column public.bookings.ics_sequence is 'iCalendar SEQUENCE for this booking''s UID; incremented on reschedule and cancel.';

-- ── 2. booking_access_requests ─────────────────────────────────────────────────────
create table if not exists public.booking_access_requests (
  id          uuid primary key default gen_random_uuid(),
  email_hash  text not null,              -- sha256(lower(trim(email)))
  token_hash  text unique,                -- sha256 of the emailed token (null when nothing was sent)
  ip_hash     text,                       -- sha256(salt + ip), for rate limiting only
  expires_at  timestamptz not null default now() + interval '1 hour',
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
-- Rows with a booking_id are short-lived manage grants issued from a consumed email link
-- (so a client can open each listed appointment without the original confirmation email).
alter table public.booking_access_requests add column if not exists booking_id uuid references public.bookings(id) on delete cascade;
create index if not exists booking_access_requests_email_idx on public.booking_access_requests (email_hash, created_at desc);
create index if not exists booking_access_requests_booking_idx on public.booking_access_requests (booking_id) where booking_id is not null;
create index if not exists booking_access_requests_ip_idx on public.booking_access_requests (ip_hash, created_at desc);

alter table public.booking_access_requests enable row level security;
revoke all on table public.booking_access_requests from anon, authenticated;

comment on table public.booking_access_requests is 'Single-use, one-hour "email me my appointments" links from /book/manage. Server-only.';

-- ── 3. Planner linking ────────────────────────────────────────────────────────────

-- The dashboard user behind a public planner page slug (null when not linked yet).
create or replace function public.booking_host_for_slug(p_slug text)
returns uuid language sql stable set search_path = public as $$
  select ep.profile_id from public.employee_profiles ep where ep.slug = p_slug limit 1
$$;

-- booking_types: fill host_staff_id from the planner page when it isn't set explicitly.
create or replace function public.booking_types_resolve_host()
returns trigger language plpgsql set search_path = public as $$
declare
  resolved uuid;
begin
  if new.host_slug is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.host_staff_id is null then
      new.host_staff_id := public.booking_host_for_slug(new.host_slug);
    end if;
  elsif new.host_slug is distinct from old.host_slug and new.host_staff_id is not distinct from old.host_staff_id then
    -- Planner page changed without an explicit "managed by" change → follow the planner.
    resolved := public.booking_host_for_slug(new.host_slug);
    if resolved is not null then
      new.host_staff_id := resolved;
    end if;
  elsif new.host_staff_id is null then
    new.host_staff_id := public.booking_host_for_slug(new.host_slug);
  end if;
  return new;
end;
$$;

drop trigger if exists booking_types_resolve_host on public.booking_types;
create trigger booking_types_resolve_host
  before insert or update of host_slug, host_staff_id on public.booking_types
  for each row execute function public.booking_types_resolve_host();

-- bookings: a new booking with no host inherits its booking page's host.
create or replace function public.bookings_resolve_host()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.host_staff_id is null then
    select coalesce(bt.host_staff_id, public.booking_host_for_slug(bt.host_slug))
      into new.host_staff_id
      from public.booking_types bt where bt.id = new.booking_type_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_resolve_host on public.bookings;
create trigger bookings_resolve_host
  before insert on public.bookings
  for each row execute function public.bookings_resolve_host();

-- employee_profiles: link profile_id from account_email when it is missing.
create or replace function public.employee_profiles_link_account()
returns trigger language plpgsql set search_path = public as $$
declare
  match uuid;
begin
  if new.profile_id is null and nullif(trim(new.account_email), '') is not null then
    select p.id into match
      from public.profiles p
     where lower(p.email) = lower(trim(new.account_email))
       and not exists (select 1 from public.employee_profiles o where o.profile_id = p.id and o.id <> new.id)
     limit 1;
    if match is not null then
      new.profile_id := match;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists employee_profiles_link_account on public.employee_profiles;
create trigger employee_profiles_link_account
  before insert or update of account_email on public.employee_profiles
  for each row execute function public.employee_profiles_link_account();

-- employee_profiles: when the linked login changes, move that planner's booking pages and
-- FUTURE bookings to it (past bookings keep their historical host).
create or replace function public.employee_profiles_propagate_host()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_profile uuid := case when tg_op = 'UPDATE' then old.profile_id else null end;
  old_slug text := case when tg_op = 'UPDATE' then old.slug else null end;
begin
  if tg_op = 'UPDATE' and new.profile_id is not distinct from old.profile_id and new.slug is not distinct from old.slug then
    return null;
  end if;
  if new.profile_id is null and old_profile is null then
    return null;
  end if;

  update public.booking_types bt
     set host_staff_id = new.profile_id, updated_at = now()
   where bt.host_slug in (new.slug, coalesce(old_slug, new.slug))
     and (bt.host_staff_id is null or bt.host_staff_id = old_profile)
     and bt.host_staff_id is distinct from new.profile_id;

  update public.bookings b
     set host_staff_id = new.profile_id, updated_at = now()
    from public.booking_types bt
   where b.booking_type_id = bt.id
     and bt.host_slug = new.slug
     and b.start_at > now()
     and (b.host_staff_id is null or b.host_staff_id = old_profile)
     and b.host_staff_id is distinct from new.profile_id;

  return null;
end;
$$;

drop trigger if exists employee_profiles_propagate_host on public.employee_profiles;
create trigger employee_profiles_propagate_host
  after insert or update of profile_id, slug on public.employee_profiles
  for each row execute function public.employee_profiles_propagate_host();

-- profiles: a new (or re-emailed) dashboard user claims the employee profile whose
-- account_email matches. That update fires the propagation trigger above.
create or replace function public.profiles_link_employee_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return null;
  end if;
  if exists (select 1 from public.employee_profiles where profile_id = new.id) then
    return null;
  end if;
  update public.employee_profiles ep
     set profile_id = new.id
   where ep.id = (
     select e.id from public.employee_profiles e
      where e.profile_id is null and lower(trim(e.account_email)) = lower(trim(new.email))
      order by e.created_at limit 1
   );
  return null;
end;
$$;

drop trigger if exists profiles_link_employee_profile on public.profiles;
create trigger profiles_link_employee_profile
  after insert or update of email on public.profiles
  for each row execute function public.profiles_link_employee_profile();

revoke all on function public.employee_profiles_propagate_host() from public, anon, authenticated;
revoke all on function public.profiles_link_employee_profile() from public, anon, authenticated;

-- ── 4. Atomic reschedule ──────────────────────────────────────────────────────────
-- Locks the planner's calendar (all booking pages on the same planner page), re-checks
-- for overlaps (excluding this booking) and moves the booking in place. Raises
-- 'slot_taken' when the new time is no longer free.
create or replace function public.booking_reschedule(p_booking_id uuid, p_start timestamptz, p_end timestamptz)
returns setof public.bookings
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  type_ids uuid[];
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found';
  end if;
  if b.status = 'canceled' then
    raise exception 'booking_canceled';
  end if;

  select array_agg(bt.id order by bt.id) into type_ids
    from public.booking_types bt
   where bt.id = b.booking_type_id
      or (bt.host_slug is not null and bt.host_slug = (select host_slug from public.booking_types where id = b.booking_type_id));

  -- Serialise concurrent bookings on this calendar.
  perform 1 from public.booking_types where id = any(type_ids) order by id for update;

  if exists (
    select 1 from public.bookings o
     where o.booking_type_id = any(type_ids)
       and o.id <> b.id
       and o.status <> 'canceled'
       and o.start_at < p_end
       and o.end_at > p_start
  ) then
    raise exception 'slot_taken';
  end if;

  return query
    update public.bookings
       set start_at = p_start,
           end_at = p_end,
           rescheduled_at = now(),
           ics_sequence = coalesce(ics_sequence, 0) + 1,
           status = case when status in ('completed', 'no_show') then status else 'confirmed' end,
           updated_at = now()
     where id = b.id
    returning *;
end;
$$;

revoke all on function public.booking_reschedule(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.booking_reschedule(uuid, timestamptz, timestamptz) to service_role;

-- ── 5. Backfill ──────────────────────────────────────────────────────────────────
-- Link employee profiles to existing dashboard users by account_email.
update public.employee_profiles ep
   set profile_id = p.id
  from public.profiles p
 where ep.profile_id is null
   and nullif(trim(ep.account_email), '') is not null
   and lower(p.email) = lower(trim(ep.account_email))
   and not exists (select 1 from public.employee_profiles o where o.profile_id = p.id);

-- Booking pages without a host follow their planner page.
update public.booking_types bt
   set host_staff_id = ep.profile_id, updated_at = now()
  from public.employee_profiles ep
 where bt.host_staff_id is null
   and bt.host_slug = ep.slug
   and ep.profile_id is not null;

-- Bookings without a host inherit it from their booking page.
update public.bookings b
   set host_staff_id = bt.host_staff_id
  from public.booking_types bt
 where b.booking_type_id = bt.id
   and b.host_staff_id is null
   and bt.host_staff_id is not null;
