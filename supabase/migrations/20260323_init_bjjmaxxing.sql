create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  belt text default 'White Belt',
  primary_archetype text,
  secondary_archetype text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archetypes (
  id text primary key,
  name text not null,
  tagline text not null,
  description text not null,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  primary_systems text[] not null default '{}',
  top_style text,
  win_path text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.skill_trees (
  id uuid primary key default gen_random_uuid(),
  archetype_id text not null references public.archetypes (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.nodes (
  id text primary key,
  tree_id uuid references public.skill_trees (id) on delete cascade,
  title text not null,
  subtitle text,
  level integer not null,
  track text not null,
  prerequisites text[] not null default '{}',
  description text not null,
  why text not null,
  success_definition text[] not null default '{}',
  videos jsonb not null default '[]'::jsonb,
  drill text,
  sparring_focus text,
  common_errors text[] not null default '{}',
  completion_rules jsonb not null default '[]'::jsonb,
  is_coming_soon boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null,
  watched boolean not null default false,
  written boolean not null default false,
  drilled boolean not null default false,
  attempted boolean not null default false,
  hit_in_sparring boolean not null default false,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, node_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  tier text not null default 'free',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_key
on public.subscriptions (user_id);

alter table public.user_profiles enable row level security;
alter table public.archetypes enable row level security;
alter table public.skill_trees enable row level security;
alter table public.nodes enable row level security;
alter table public.progress enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles_select_own" on public.user_profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.user_profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.user_profiles
for update using (auth.uid() = id);

create policy "archetypes_public_read" on public.archetypes
for select using (true);

create policy "skill_trees_public_read" on public.skill_trees
for select using (true);

create policy "nodes_public_read" on public.nodes
for select using (true);

create policy "progress_select_own" on public.progress
for select using (auth.uid() = user_id);

create policy "progress_insert_own" on public.progress
for insert with check (auth.uid() = user_id);

create policy "progress_update_own" on public.progress
for update using (auth.uid() = user_id);

create policy "subscriptions_select_own" on public.subscriptions
for select using (auth.uid() = user_id);
