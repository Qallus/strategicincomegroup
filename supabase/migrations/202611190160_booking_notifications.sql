-- Booking notification opt-ins (public /book flow).
--
-- The client chooses, per booking, whether they want email and/or text reminders and
-- updates. Both default OFF; the SMS choice stores the exact consent text shown, plus
-- when/where it was given, so the opt-in is auditable (TCPA / A2P 10DLC).
--
-- Safe to run more than once. The app keeps working before this runs: the booking
-- insert retries without these columns if they don't exist yet.

alter table public.bookings add column if not exists notify_email boolean not null default false;
alter table public.bookings add column if not exists notify_sms boolean not null default false;
alter table public.bookings add column if not exists notify_consent_at timestamptz;
alter table public.bookings add column if not exists sms_consent_text text;
alter table public.bookings add column if not exists consent_ip text;
alter table public.bookings add column if not exists consent_user_agent text;
-- Which notifications actually went out (client_email, client_sms, planner_email, planner_sms, dashboard).
alter table public.bookings add column if not exists notifications_sent jsonb not null default '{}'::jsonb;

comment on column public.bookings.notify_email is 'Client opted in to email reminders and updates for this booking.';
comment on column public.bookings.notify_sms is 'Client opted in to SMS reminders and updates for this booking (requires invitee_phone).';
comment on column public.bookings.sms_consent_text is 'Exact SMS consent disclosure shown to the client when they opted in.';
comment on column public.bookings.notifications_sent is 'Delivery outcome per channel, written after the booking is created.';

-- Consent events from the booking flow use source = ''booking''.
alter table public.consent_events drop constraint if exists consent_events_source_check;
alter table public.consent_events add constraint consent_events_source_check
  check (source = any (array['web_form', 'admin_manual', 'bulk_import', 'keyword_stop', 'keyword_start', 'csv_import', 'booking']));

-- Lets planners find "their" dashboard notifications quickly.
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
