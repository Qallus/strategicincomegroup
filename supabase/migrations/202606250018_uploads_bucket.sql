-- Public storage bucket for dashboard uploads (business-card images, etc.).
-- Writes go through the service-role admin client (bypasses RLS); public read.
insert into storage.buckets (id, name, public)
values ('sig-media', 'sig-media', true)
on conflict (id) do nothing;
