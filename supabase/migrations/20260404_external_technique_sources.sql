create table if not exists public.external_technique_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('outlierdb')),
  source_url text not null unique,
  source_type text not null check (source_type in ('sequence')),
  title text not null,
  video_url text,
  video_platform text,
  timestamp_label text,
  timestamp_seconds integer,
  hashtags text[] not null default '{}',
  summary text,
  search_query text,
  raw_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists external_technique_sources_provider_idx
on public.external_technique_sources (provider, imported_at desc);

create index if not exists external_technique_sources_query_idx
on public.external_technique_sources (search_query, imported_at desc);

create index if not exists external_technique_sources_timestamp_idx
on public.external_technique_sources (timestamp_seconds);

create index if not exists external_technique_sources_hashtags_idx
on public.external_technique_sources using gin (hashtags);

alter table public.external_technique_sources enable row level security;

create policy "external_technique_sources_public_read" on public.external_technique_sources
for select using (true);

create table if not exists public.node_external_sources (
  id uuid primary key default gen_random_uuid(),
  node_id text not null,
  external_source_id uuid not null references public.external_technique_sources (id) on delete cascade,
  role text not null check (role in ('main_reference', 'counter_reference', 'drill_reference', 'related_reference')),
  notes text,
  created_at timestamptz not null default now(),
  unique (node_id, external_source_id, role)
);

create index if not exists node_external_sources_node_idx
on public.node_external_sources (node_id, role, created_at asc);

create index if not exists node_external_sources_source_idx
on public.node_external_sources (external_source_id);

alter table public.node_external_sources enable row level security;

create policy "node_external_sources_public_read" on public.node_external_sources
for select using (true);
