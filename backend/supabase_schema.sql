-- ─────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- trigram indexes for fast text search


-- ─────────────────────────────────────────────────────────────
-- 1. profiles
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid         primary key references auth.users(id) on delete cascade,
  email       text         not null,
  full_name   text         not null default '',
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS for profiles
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────
-- 2. cases
-- ─────────────────────────────────────────────────────────────
create table if not exists public.cases (

  id                  uuid         primary key default gen_random_uuid(),
  user_id             uuid         not null references auth.users(id) on delete cascade,

  -- Step-1 form fields (AddCaseStepOnePage)
  case_ref            text         not null,           -- human-readable ID e.g. "DL-2026-0514-001"
  case_type           text         not null default 'Forgery',
  subject_names       text         not null default '',
  signer_name         text         not null default '', -- whose signature is under examination
  date_received       text         not null default '', -- stored as text; client formats display

  -- Step-2 form fields (AddCaseStepTwoPage)
  upload_reason       text         not null default '',
  sample_description  text         not null default '',


  questioned_url      text,                            
  reference_urls      text[]       not null default '{}', 


  status              text         not null default 'pending'
                        check (status in ('pending','uploaded','analyzing','analyzed','error')),


  verdict             text         check (verdict in ('FORGED','GENUINE')),
  confidence          int          check (confidence >= 0 and confidence <= 100),

  analysis_result     jsonb,

  -- Timestamps
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────

create index if not exists cases_user_id_idx
  on public.cases (user_id, created_at desc);

create index if not exists cases_user_case_idx
  on public.cases (id, user_id);

create index if not exists cases_case_ref_trgm_idx
  on public.cases using gin (case_ref gin_trgm_ops);

create index if not exists cases_signer_name_trgm_idx
  on public.cases using gin (signer_name gin_trgm_ops);

create index if not exists cases_pending_idx
  on public.cases (user_id)
  where status = 'pending';

-- ── auto-update updated_at ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cases_updated_at on public.cases;
create trigger cases_updated_at
  before update on public.cases
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────
alter table public.cases enable row level security;

-- Users can only see their own cases
create policy "cases_select_own"
  on public.cases for select
  using (auth.uid() = user_id);

-- Users can only insert cases they own
create policy "cases_insert_own"
  on public.cases for insert
  with check (auth.uid() = user_id);

-- Users can only update their own cases
create policy "cases_update_own"
  on public.cases for update
  using (auth.uid() = user_id);

-- Users can only delete their own cases
create policy "cases_delete_own"
  on public.cases for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Storage bucket: documents
--    Stores: questioned docs, reference docs, and signature crops.
--
--    Folder layout inside the bucket:
--      {user_id}/{case_id}/questioned/{filename}
--      {user_id}/{case_id}/references/{filename}
--      {user_id}/{case_id}/crops/questioned_crop.png
--      {user_id}/{case_id}/crops/ref_crop_00.png
--      {user_id}/{case_id}/crops/ref_crop_01.png  ...
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  true,           
  104857600,   
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'
  ]
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS ──────────────────────────────────────────────

drop policy if exists "storage_upload_own"  on storage.objects;
drop policy if exists "storage_read_own"    on storage.objects;
drop policy if exists "storage_delete_own"  on storage.objects;
drop policy if exists "storage_update_own"  on storage.objects;


create policy "storage_read_public"
  on storage.objects for select
  using (bucket_id = 'documents');

create policy "storage_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


create policy "storage_update_own"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─────────────────────────────────────────────────────────────
-- 4. Useful views
-- ─────────────────────────────────────────────────────────────

-- Per-user summary: total, flagged, analyzed counts
create or replace view public.case_summary as
select
  user_id,
  count(*)                                        as total_cases,
  count(*) filter (where verdict = 'FORGED')      as flagged_cases,
  count(*) filter (where verdict = 'GENUINE')     as genuine_cases,
  count(*) filter (where status  = 'analyzed')    as analyzed_cases,
  count(*) filter (where status  = 'pending')     as pending_cases,
  count(*) filter (where status  = 'error')       as error_cases
from public.cases
group by user_id;



-- ─────────────────────────────────────────────────────────────
-- 5. Migration helpers
-- ─────────────────────────────────────────────────────────────

-- Add columns added in v2 (safe: IF NOT EXISTS)
-- alter table public.cases add column if not exists signer_name text not null default '';
-- alter table public.cases add column if not exists upload_reason text not null default '';
-- alter table public.cases add column if not exists sample_description text not null default '';

-- Add status constraint (only needed if column exists without the check)
-- alter table public.cases drop constraint if exists cases_status_check;
-- alter table public.cases add constraint cases_status_check
--   check (status in ('pending','uploaded','analyzing','analyzed','error'));

-- Add verdict constraint
-- alter table public.cases drop constraint if exists cases_verdict_check;
-- alter table public.cases add constraint cases_verdict_check
--   check (verdict in ('FORGED','GENUINE'));

-- Backfill profiles for existing users (run once after adding the profiles table)
-- insert into public.profiles (id, email, full_name)
-- select id, email, coalesce(raw_user_meta_data->>'full_name', '')
-- from auth.users
-- on conflict (id) do nothing;
