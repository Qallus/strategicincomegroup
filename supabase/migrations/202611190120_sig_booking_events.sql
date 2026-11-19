-- SIG native booking + events (replaces WordPress FluentBooking and the sig-events CPT).
--
-- booking_types gain the public planner they belong to (host_slug → /team/<slug>)
-- and their office; events gain the fields the live strategicincomegroup.com
-- events use (type, series, speakers, office, audience, deadline, guests, arrival
-- note, online meeting details). The MJG seed rows from the fork are replaced
-- with SIG planners' booking pages and SIG's current events.

-- ── Booking types ───────────────────────────────────────────────────────────────
alter table public.booking_types add column if not exists host_slug text;
alter table public.booking_types add column if not exists office text;
alter table public.booking_types add column if not exists audience text not null default 'everyone'
  check (audience in ('everyone', 'new_clients', 'clients'));
alter table public.booking_types alter column timezone set default 'America/Phoenix';
create index if not exists bt_host_slug_idx on public.booking_types(host_slug);
create index if not exists bt_host_staff_idx on public.booking_types(host_staff_id);

-- ── Events ──────────────────────────────────────────────────────────────────────
alter table public.events add column if not exists event_type text not null default 'workshop'
  check (event_type in ('roundtable', 'workshop', 'luncheon', 'webinar', 'community_service', 'client_appreciation', 'church', 'other'));
alter table public.events add column if not exists series text;
alter table public.events add column if not exists speakers jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists office text;
alter table public.events add column if not exists directions_url text;
alter table public.events add column if not exists audience text not null default 'public'
  check (audience in ('public', 'clients', 'clients_and_guests', 'invite_only'));
alter table public.events add column if not exists waitlist_enabled boolean not null default true;
alter table public.events add column if not exists allow_guests boolean not null default true;
alter table public.events add column if not exists max_party_size integer not null default 4 check (max_party_size between 1 and 50);
alter table public.events add column if not exists arrival_note text;
alter table public.events add column if not exists meeting_id text;
alter table public.events alter column timezone set default 'America/Phoenix';
create index if not exists ev_type_idx on public.events(event_type);
create index if not exists ev_host_staff_idx on public.events(host_staff_id);

-- ── Replace the MJG fork's seed data ────────────────────────────────────────────
delete from public.booking_types
 where slug in ('stewardship-consultation', 'pastor-partnership-call', 'discovery-call')
   and not exists (select 1 from public.bookings b where b.booking_type_id = booking_types.id);

delete from public.events
 where slug = 'stewardship-blueprint-webinar'
   and not exists (select 1 from public.event_registrations r where r.event_id = events.id);

-- Planner booking pages (one consultation + one review per planner, Mike's 403(b) call).
insert into public.booking_types
  (slug, name, description, duration_minutes, location_type, location_details, color, host_name, host_slug, office, audience,
   timezone, min_notice_hours, max_advance_days, questions, confirmation_message)
values
  ('laurie-simons-consultation', 'Free Consultation',
   'A 30-minute introduction with Laurie Simons, CFP®, CTFA® — in person at our Chandler office or by phone.',
   30, 'in_person', '2330 W Ray Rd. #3, Chandler, AZ 85224', '#1e3a8a', 'Laurie Simons, CFP®, CTFA®', 'laurie-simons', 'East Valley Office', 'new_clients',
   'America/Phoenix', 24, 60,
   '[{"key":"meeting","label":"How would you like to meet?","type":"select","required":true,"options":["In person (Chandler office)","Phone call","Video call"]},{"key":"goals","label":"What would you like to talk about?","type":"textarea","required":false}]'::jsonb,
   'You''re booked! A confirmation with the details is on its way to your inbox.'),
  ('laurie-simons-review', 'Client Review Meeting',
   'A 60-minute review of your plan and portfolio with Laurie Simons, CFP®, CTFA®.',
   60, 'in_person', '2330 W Ray Rd. #3, Chandler, AZ 85224', '#b88a4a', 'Laurie Simons, CFP®, CTFA®', 'laurie-simons', 'East Valley Office', 'clients',
   'America/Phoenix', 48, 90,
   '[{"key":"meeting","label":"How would you like to meet?","type":"select","required":true,"options":["In person (Chandler office)","Phone call","Video call"]},{"key":"topics","label":"Anything you''d like to cover?","type":"textarea","required":false}]'::jsonb,
   'Your review is booked. We''ll send any paperwork to prepare ahead of time.'),
  ('chad-manberg-consultation', 'Free Consultation',
   'A 30-minute introduction with Chad Manberg, CFP® — in person at our Peoria office or by phone.',
   30, 'in_person', '20542 N. Lake Pleasant Rd. #119, Peoria, AZ 85382', '#1e3a8a', 'Chad Manberg, CFP®', 'chad-manberg', 'West Valley Office', 'new_clients',
   'America/Phoenix', 24, 60,
   '[{"key":"meeting","label":"How would you like to meet?","type":"select","required":true,"options":["In person (Peoria office)","Phone call","Video call"]},{"key":"goals","label":"What would you like to talk about?","type":"textarea","required":false}]'::jsonb,
   'You''re booked! A confirmation with the details is on its way to your inbox.'),
  ('chad-manberg-review', 'Client Review Meeting',
   'A 60-minute review of your plan and portfolio with Chad Manberg, CFP®.',
   60, 'in_person', '20542 N. Lake Pleasant Rd. #119, Peoria, AZ 85382', '#b88a4a', 'Chad Manberg, CFP®', 'chad-manberg', 'West Valley Office', 'clients',
   'America/Phoenix', 48, 90,
   '[{"key":"meeting","label":"How would you like to meet?","type":"select","required":true,"options":["In person (Peoria office)","Phone call","Video call"]},{"key":"topics","label":"Anything you''d like to cover?","type":"textarea","required":false}]'::jsonb,
   'Your review is booked. We''ll send any paperwork to prepare ahead of time.'),
  ('keri-alcos-consultation', 'Free Consultation',
   'A 30-minute introduction with Keri Alcos, CWS® — in person at our Peoria office or by phone. Medicare questions welcome.',
   30, 'in_person', '20542 N. Lake Pleasant Rd. #119, Peoria, AZ 85382', '#1e3a8a', 'Keri Alcos, CWS®', 'keri-alcos', 'West Valley Office', 'new_clients',
   'America/Phoenix', 24, 60,
   '[{"key":"meeting","label":"How would you like to meet?","type":"select","required":true,"options":["In person (Peoria office)","Phone call","Video call"]},{"key":"goals","label":"What would you like to talk about?","type":"textarea","required":false}]'::jsonb,
   'You''re booked! A confirmation with the details is on its way to your inbox.'),
  ('keri-alcos-review', 'Client Review Meeting',
   'A 60-minute review of your plan and portfolio with Keri Alcos, CWS®.',
   60, 'in_person', '20542 N. Lake Pleasant Rd. #119, Peoria, AZ 85382', '#b88a4a', 'Keri Alcos, CWS®', 'keri-alcos', 'West Valley Office', 'clients',
   'America/Phoenix', 48, 90,
   '[{"key":"meeting","label":"How would you like to meet?","type":"select","required":true,"options":["In person (Peoria office)","Phone call","Video call"]},{"key":"topics","label":"Anything you''d like to cover?","type":"textarea","required":false}]'::jsonb,
   'Your review is booked. We''ll send any paperwork to prepare ahead of time.'),
  ('michael-gauthier-403b', 'Kingdom Stewardship 403(b) Conversation',
   'A 45-minute conversation with Mike Gauthier, CFP®, about faith-based 403(b) plans and stewardship for your church.',
   45, 'video', 'Video call — link sent with your confirmation', '#4f8a6b', 'Michael Gauthier, CFP®', 'michael-gauthier', 'East Valley Office', 'everyone',
   'America/Phoenix', 24, 60,
   '[{"key":"organization","label":"Church or organization","type":"text","required":true},{"key":"staff","label":"Number of staff","type":"select","required":false,"options":["1–5","6–15","16–50","51–100","100+"]}]'::jsonb,
   'Thank you — Mike looks forward to the conversation.')
on conflict (slug) do nothing;

-- Weekday 9–5 (SIG office hours) for the new booking types that have no rules yet.
insert into public.booking_availability (booking_type_id, day_of_week, start_time, end_time, is_active)
select bt.id, d.dow, '09:00', '17:00', true
  from public.booking_types bt
 cross join (values (1), (2), (3), (4), (5)) as d(dow)
 where bt.host_slug is not null
   and not exists (select 1 from public.booking_availability a where a.booking_type_id = bt.id);

-- SIG events from strategicincomegroup.com/events.
insert into public.events
  (slug, title, summary, description, status, start_at, end_at, timezone, location_type, location_name, location_address,
   directions_url, capacity, registration_required, registration_closes_at, host_name, is_public, published_at,
   event_type, series, speakers, office, audience, waitlist_enabled, allow_guests, max_party_size, arrival_note)
values
  ('fmsc-food-packing-event-december', 'Feed My Starving Children — December 2nd',
   'This hands-on event will involve packing nutritious meals that will be shipped to countries in desperate need of our help, offering hope and nutrition to those who need it most.',
   'Whether you’re a first-time volunteer or a seasoned supporter, your participation will directly impact the lives of those in need.

Feed My Starving Children (FMSC) believes hope starts with food. As a Christian nonprofit, FMSC is dedicated to seeing every child whole in body and spirit. FMSC works with food distribution partners that stay with communities for the long haul, empowering them to move from relief to development.

FMSC meals are developed by food science and nutrition professionals to supplement nutritional needs and reduce problems with malnutrition. Nutrition allows children to grow, thrive and develop to their full potential.',
   'published', '2026-12-02T21:00:00Z', '2026-12-02T23:00:00Z', 'America/Phoenix', 'in_person', 'FMSC — Tempe, AZ',
   '1100 W Grove Pkwy Suite 101, Tempe, AZ 85283',
   'https://www.google.com/maps/dir/?api=1&destination=Feed+My+Starving+Children,+1100+W+Grove+Pkwy+Suite+101,+Tempe,+AZ+85283',
   25, true, '2026-11-17T06:59:00Z', 'Strategic Income Group', true, now(),
   'community_service', 'SIGCares', '[]'::jsonb, null, 'public', true, true, 6, 'Arrive 10 minutes early.'),
  ('caregivers-circle', 'Caregivers Circle — Roundtable Event',
   'A private roundtable for clients caring for aging parents, spouses, family members, or other loved ones—or preparing for future care responsibilities.',
   'Caregiving often arrives gradually, then suddenly. A parent needs more help. A spouse’s health changes. A loved one can no longer manage everything alone. Families find themselves navigating medical decisions, financial responsibilities, housing questions, legal documents, long-term care, family communication, and emotional strain.

Caregivers Circle is a private roundtable for clients currently helping care for someone they love, preparing for future care responsibilities, or wanting to better understand what should be organized ahead of time. The conversation will explore practical preparation, family communication, financial organization, healthcare decision-making, estate planning considerations, and the emotional realities of caring for others.

Participants will leave with a caregiver readiness reflection to identify one conversation to have, one document or decision to clarify, one support need to consider, and one next step to reduce crisis-driven decision-making.',
   'completed', '2026-11-12T17:00:00Z', '2026-11-12T18:30:00Z', 'America/Phoenix', 'in_person', 'SIG Chandler Office',
   '2330 W Ray Rd. #3, Chandler, AZ 85224',
   'https://www.google.com/maps/dir/?api=1&destination=Strategic+Income+Group,+2330+W+Ray+Rd+%233,+Chandler,+AZ+85224',
   10, true, '2026-11-11T06:59:00Z', 'Michael Gauthier', true, now(),
   'roundtable', 'SIG Private Roundtable Series · Life. Resources. Legacy.',
   '[{"name":"Michael Gauthier, CFP®","title":"Founder & CEO","team_slug":"michael-gauthier"}]'::jsonb,
   'East Valley Office', 'clients', true, false, 2, 'Arrive 10 minutes early.')
on conflict (slug) do nothing;
