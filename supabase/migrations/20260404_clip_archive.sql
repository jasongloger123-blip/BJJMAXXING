create table if not exists public.clip_archive (
  id uuid primary key default gen_random_uuid(),
  external_source_id uuid unique references public.external_technique_sources (id) on delete set null,
  source_run_id uuid references public.external_technique_search_runs (id) on delete set null,
  provider text not null,
  source_url text not null,
  source_type text not null,
  title text not null,
  video_url text,
  video_platform text,
  timestamp_label text,
  timestamp_seconds integer,
  hashtags text[] not null default '{}',
  summary text,
  search_query text,
  raw_payload jsonb not null default '{}'::jsonb,
  assignment_status text not null default 'unassigned' check (assignment_status in ('unassigned', 'assigned', 'hidden', 'archived')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists clip_archive_status_idx
on public.clip_archive (assignment_status, created_at desc);

create index if not exists clip_archive_run_idx
on public.clip_archive (source_run_id, created_at desc);

create index if not exists clip_archive_timestamp_idx
on public.clip_archive (timestamp_seconds);

create index if not exists clip_archive_hashtags_idx
on public.clip_archive using gin (hashtags);

alter table public.clip_archive enable row level security;

create policy "clip_archive_public_read" on public.clip_archive
for select using (true);

create table if not exists public.clip_assignments (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.clip_archive (id) on delete cascade,
  assignment_kind text not null check (assignment_kind in ('node', 'connection')),
  node_id text,
  from_node_id text,
  to_node_id text,
  role text check (role in ('main_reference', 'counter_reference', 'drill_reference', 'related_reference')),
  display_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint clip_assignments_node_shape check (
    (assignment_kind = 'node' and node_id is not null and from_node_id is null and to_node_id is null)
    or
    (assignment_kind = 'connection' and node_id is null and from_node_id is not null and to_node_id is not null)
  ),
  unique (clip_id, node_id, role),
  unique (clip_id, from_node_id, to_node_id)
);

create index if not exists clip_assignments_node_idx
on public.clip_assignments (assignment_kind, node_id, role, display_order asc);

create index if not exists clip_assignments_connection_idx
on public.clip_assignments (assignment_kind, from_node_id, to_node_id, display_order asc);

create index if not exists clip_assignments_clip_idx
on public.clip_assignments (clip_id);

alter table public.clip_assignments enable row level security;

create policy "clip_assignments_public_read" on public.clip_assignments
for select using (true);
