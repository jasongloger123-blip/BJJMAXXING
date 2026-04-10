create table if not exists public.external_technique_search_run_sections (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.external_technique_search_runs (id) on delete cascade,
  section_key text not null,
  section_title text not null,
  section_order integer not null,
  section_summary text,
  created_at timestamptz not null default now(),
  unique (run_id, section_key)
);

create index if not exists external_technique_search_run_sections_run_idx
on public.external_technique_search_run_sections (run_id, section_order asc);

alter table public.external_technique_search_run_sections enable row level security;

create policy "external_technique_search_run_sections_public_read" on public.external_technique_search_run_sections
for select using (true);

create table if not exists public.external_technique_search_run_section_sources (
  id uuid primary key default gen_random_uuid(),
  run_section_id uuid not null references public.external_technique_search_run_sections (id) on delete cascade,
  external_source_id uuid not null references public.external_technique_sources (id) on delete cascade,
  source_order integer not null default 0,
  evidence_text text,
  created_at timestamptz not null default now(),
  unique (run_section_id, external_source_id)
);

create index if not exists external_technique_search_run_section_sources_section_idx
on public.external_technique_search_run_section_sources (run_section_id, source_order asc);

create index if not exists external_technique_search_run_section_sources_source_idx
on public.external_technique_search_run_section_sources (external_source_id);

alter table public.external_technique_search_run_section_sources enable row level security;

create policy "external_technique_search_run_section_sources_public_read" on public.external_technique_search_run_section_sources
for select using (true);
