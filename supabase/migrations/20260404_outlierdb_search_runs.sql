create table if not exists public.external_technique_search_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('outlierdb')),
  mode text not null check (mode in ('tag_search', 'ai_chat')),
  label text not null,
  query text,
  hashtags text[] not null default '{}',
  page integer,
  limit_count integer,
  imported_count integer not null default 0,
  failed_count integer not null default 0,
  has_more boolean not null default false,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists external_technique_search_runs_created_idx
on public.external_technique_search_runs (created_at desc);

create index if not exists external_technique_search_runs_mode_idx
on public.external_technique_search_runs (mode, created_at desc);

alter table public.external_technique_search_runs enable row level security;

create policy "external_technique_search_runs_public_read" on public.external_technique_search_runs
for select using (true);

create table if not exists public.external_technique_search_run_sources (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.external_technique_search_runs (id) on delete cascade,
  external_source_id uuid not null references public.external_technique_sources (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (run_id, external_source_id)
);

create index if not exists external_technique_search_run_sources_run_idx
on public.external_technique_search_run_sources (run_id, created_at asc);

create index if not exists external_technique_search_run_sources_source_idx
on public.external_technique_search_run_sources (external_source_id);

alter table public.external_technique_search_run_sources enable row level security;

create policy "external_technique_search_run_sources_public_read" on public.external_technique_search_run_sources
for select using (true);
