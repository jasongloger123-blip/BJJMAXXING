create table if not exists public.training_clip_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null,
  clip_key text not null,
  clip_type text not null,
  result text not null,
  created_at timestamptz not null default now()
);

create index if not exists training_clip_events_user_created_idx
on public.training_clip_events (user_id, created_at desc);

create index if not exists training_clip_events_user_node_idx
on public.training_clip_events (user_id, node_id);

alter table public.training_clip_events enable row level security;

create policy "training_clip_events_select_own" on public.training_clip_events
for select using (auth.uid() = user_id);

create policy "training_clip_events_insert_own" on public.training_clip_events
for insert with check (auth.uid() = user_id);
