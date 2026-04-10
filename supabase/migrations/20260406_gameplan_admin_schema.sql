create table if not exists public.gameplans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  headline text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  creator_name text not null default 'BJJMAXXING',
  creator_role text not null default 'Custom Plan',
  creator_initials text not null default 'BM',
  creator_profile_href text not null default '/profile',
  canvas_width integer not null default 1600,
  canvas_height integer not null default 900,
  main_path_node_ids text[] not null default '{}',
  is_fallback_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gameplans_status_idx on public.gameplans (status);
create unique index if not exists gameplans_fallback_default_unique_idx
on public.gameplans (is_fallback_default)
where is_fallback_default = true;

create table if not exists public.gameplan_nodes (
  id text primary key,
  plan_id uuid not null references public.gameplans (id) on delete cascade,
  title text not null,
  stage text not null check (stage in ('position', 'pass', 'submission')),
  label text not null,
  description text not null default '',
  outcome text not null default '',
  focus_items text[] not null default '{}',
  mistake_items text[] not null default '{}',
  node_state text not null default 'available' check (node_state in ('completed', 'current', 'available', 'locked')),
  expansion_paths jsonb not null default '[]'::jsonb,
  source_node_id text references public.nodes (id) on delete set null,
  unlock_phase text check (unlock_phase in ('core', 'expansion')),
  unlock_order integer,
  requires_validation boolean not null default false,
  unlock_parent_node_id text,
  canvas_x integer not null default 0,
  canvas_y integer not null default 0,
  tier integer,
  lane integer,
  node_size text not null default 'main' check (node_size in ('main', 'branch', 'future')),
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists gameplan_nodes_plan_idx on public.gameplan_nodes (plan_id, order_index asc);

create table if not exists public.gameplan_edges (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.gameplans (id) on delete cascade,
  from_node_id text not null references public.gameplan_nodes (id) on delete cascade,
  to_node_id text not null references public.gameplan_nodes (id) on delete cascade,
  label text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, from_node_id, to_node_id)
);

create index if not exists gameplan_edges_plan_idx on public.gameplan_edges (plan_id, order_index asc);

create table if not exists public.gameplan_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.gameplans (id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'archetype')),
  profile_id uuid references public.user_profiles (id) on delete cascade,
  archetype_id text references public.archetypes (id) on delete cascade,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((profile_id is not null) or (archetype_id is not null))
);

create index if not exists gameplan_assignments_plan_idx on public.gameplan_assignments (plan_id, priority asc);
create index if not exists gameplan_assignments_profile_idx on public.gameplan_assignments (profile_id) where profile_id is not null;
create index if not exists gameplan_assignments_archetype_idx on public.gameplan_assignments (archetype_id) where archetype_id is not null;

alter table public.gameplans enable row level security;
alter table public.gameplan_nodes enable row level security;
alter table public.gameplan_edges enable row level security;
alter table public.gameplan_assignments enable row level security;
