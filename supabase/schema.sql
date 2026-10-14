-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Creates the job_cards table and locks it down with Row Level Security so
-- the public anon key (which lives in the client-side JS, visible to anyone)
-- can INSERT new submissions but cannot read, update, or delete anyone's
-- data. There is no office/admin dashboard built yet (see README) — until
-- there is, the only way to read submissions back is the Supabase dashboard
-- Table Editor (logged in as you) or the SQL Editor.

create table if not exists public.job_cards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  job_no text,
  job_date date,
  technician text,

  client_name text not null,
  contact_number text,
  vat_no text,
  address text,

  area_treated text,
  work_description text not null,

  warranty_no text,
  warranty_start date,
  warranty_end date,
  covers jsonb not null default '[]',
  active_ingredients jsonb not null default '[]',
  warranty_comments text,

  signatory_name text not null,
  confirmed boolean not null default false,

  photo_before_url text,
  photo_after_url text,
  extra_photo_urls jsonb not null default '[]',
  signature_url text,
  pdf_url text
);

alter table public.job_cards enable row level security;

-- Needed when "automatically expose new tables" is off: lets the anon role
-- insert (RLS below still blocks reading, updating and deleting).
grant insert on public.job_cards to anon;

-- Anyone holding the anon key (i.e. anyone who can load the page) may insert
-- a new job card row. This is intentionally permissive because there is no
-- technician login yet — add auth later (see README) if you want to
-- restrict submissions to signed-in technicians instead.
drop policy if exists "Anyone can submit a job card" on public.job_cards;
create policy "Anyone can submit a job card"
  on public.job_cards
  for insert
  to anon
  with check (true);

-- No select/update/delete policy is created for anon, so the public key
-- cannot read, change, or delete any row — including rows it just inserted.


-- ----------------------------------------------------------------------
-- Storage buckets
-- ----------------------------------------------------------------------
-- Buckets themselves are usually created from the dashboard (Storage → New
-- bucket), since that's more reliable than doing it from SQL. Create two:
--   1. job-card-photos  (public bucket)
--   2. job-card-pdfs    (public bucket)
-- "Public" here only means files can be read by anyone with the exact URL
-- (URLs are unguessable, containing a timestamp + job number) — it does NOT
-- mean anyone can browse or list the bucket's contents.
--
-- After creating them, run the policies below so the anon key can upload
-- (but not overwrite others' files, list, or delete):

insert into storage.buckets (id, name, public)
  values ('job-card-photos', 'job-card-photos', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('job-card-pdfs', 'job-card-pdfs', true)
  on conflict (id) do nothing;

drop policy if exists "Anyone can upload job card photos" on storage.objects;
create policy "Anyone can upload job card photos"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'job-card-photos');

drop policy if exists "Anyone can upload job card pdfs" on storage.objects;
create policy "Anyone can upload job card pdfs"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'job-card-pdfs');

drop policy if exists "Public can read job card photos" on storage.objects;
create policy "Public can read job card photos"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'job-card-photos');

drop policy if exists "Public can read job card pdfs" on storage.objects;
create policy "Public can read job card pdfs"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'job-card-pdfs');
