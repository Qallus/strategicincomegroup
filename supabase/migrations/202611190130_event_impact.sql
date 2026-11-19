-- SIGCares impact results on events (Feed My Starving Children packings).
--
-- Each event can record what it achieved: which giving program it belongs to,
-- how many people came, meals packed and the countries the meals went to. Kids
-- fed for a year is derived on read (meals ÷ 365, FMSC's own conversion) so it
-- can never drift from the meal count. Apply after 202611190120 (which creates
-- the Dec 2, 2026 packing).

alter table public.events add column if not exists impact_program text;
alter table public.events add column if not exists impact_participants integer check (impact_participants is null or impact_participants >= 0);
alter table public.events add column if not exists impact_meals integer check (impact_meals is null or impact_meals >= 0);
alter table public.events add column if not exists impact_countries text[] not null default '{}';
alter table public.events add column if not exists impact_notes text;
create index if not exists ev_impact_program_idx on public.events(impact_program);

-- The upcoming packing is part of the program (results get entered after Dec 2).
update public.events set impact_program = 'fmsc'
 where slug = 'fmsc-food-packing-event-december' and impact_program is null;

-- Past packings (docs/events/fmsc/fmsc-food-packing-results), as completed records.
-- Completed events never appear in public listings; they feed /sigcares.
insert into public.events
  (slug, title, summary, status, start_at, end_at, timezone, location_type, location_name, location_address,
   registration_required, host_name, is_public, published_at, event_type, series, office, audience,
   impact_program, impact_participants, impact_meals, impact_countries)
values
  ('fmsc-food-packing-2024-12', 'Feed My Starving Children — December 2024',
   'SIG clients, family and friends packed meals with Feed My Starving Children in Tempe.',
   'completed', '2024-12-04T21:00:00Z', '2024-12-04T23:00:00Z', 'America/Phoenix', 'in_person', 'FMSC — Tempe, AZ',
   '1100 W Grove Pkwy Suite 101, Tempe, AZ 85283', false, 'Strategic Income Group', true, '2024-12-04T21:00:00Z',
   'community_service', 'SIGCares', null, 'public', 'fmsc', 9, 29160, array['Cambodia', 'Philippines']),
  ('fmsc-food-packing-2025-06', 'Feed My Starving Children — June 2025',
   'SIG clients, family and friends packed meals with Feed My Starving Children in Tempe.',
   'completed', '2025-06-04T21:00:00Z', '2025-06-04T23:00:00Z', 'America/Phoenix', 'in_person', 'FMSC — Tempe, AZ',
   '1100 W Grove Pkwy Suite 101, Tempe, AZ 85283', false, 'Strategic Income Group', true, '2025-06-04T21:00:00Z',
   'community_service', 'SIGCares', null, 'public', 'fmsc', null, 24408, array['Peru', 'Guatemala']),
  ('fmsc-food-packing-2025-12', 'Feed My Starving Children — December 2025',
   'SIG clients, family and friends packed meals with Feed My Starving Children in Tempe.',
   'completed', '2025-12-03T21:00:00Z', '2025-12-03T23:00:00Z', 'America/Phoenix', 'in_person', 'FMSC — Tempe, AZ',
   '1100 W Grove Pkwy Suite 101, Tempe, AZ 85283', false, 'Strategic Income Group', true, '2025-12-03T21:00:00Z',
   'community_service', 'SIGCares', null, 'public', 'fmsc', null, 27000, array['Cambodia', 'Philippines']),
  ('fmsc-food-packing-2026-06', 'Feed My Starving Children — June 2026',
   'SIG clients, family and friends packed meals with Feed My Starving Children in Tempe.',
   'completed', '2026-06-03T21:00:00Z', '2026-06-03T23:00:00Z', 'America/Phoenix', 'in_person', 'FMSC — Tempe, AZ',
   '1100 W Grove Pkwy Suite 101, Tempe, AZ 85283', false, 'Strategic Income Group', true, '2026-06-03T21:00:00Z',
   'community_service', 'SIGCares', null, 'public', 'fmsc', null, 11880, array['Thailand'])
on conflict (slug) do nothing;
