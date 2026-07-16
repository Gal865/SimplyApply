create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null unique,
  full_name text,
  target_title text not null,
  location text,
  min_salary integer,
  work_modes text[] not null default '{}',
  resume_text text,
  resume_file_name text,
  daily_digest_time time not null default '07:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null references public.profiles(owner_email) on delete cascade,
  external_id text not null,
  source text not null check (source in ('LinkedIn', 'Indeed')),
  title text not null,
  company text not null,
  location text,
  work_mode text,
  salary_text text,
  apply_url text not null,
  description text,
  cover_letter text,
  match_score integer check (match_score between 0 and 100),
  match_reasons jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'saved', 'applied', 'dismissed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_email, external_id)
);

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null references public.profiles(owner_email) on delete cascade,
  job_external_id text not null,
  company text,
  job_title text,
  content text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null references public.profiles(owner_email) on delete cascade,
  status text not null check (status in ('started', 'complete', 'failed')),
  result_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists jobs_owner_status_idx on public.jobs (owner_email, status, match_score desc);
create index if not exists cover_letters_owner_created_idx on public.cover_letters (owner_email, created_at desc);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.cover_letters enable row level security;
alter table public.search_runs enable row level security;

-- No public policies are created. The web app talks to Supabase only from
-- server routes using the service-role key, after Sites identifies the user.
