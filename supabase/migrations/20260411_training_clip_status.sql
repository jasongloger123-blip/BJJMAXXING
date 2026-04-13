create table if not exists public.training_clip_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null,
  clip_key text not null,
  clip_type text not null,
  clip_id uuid references public.clip_archive (id) on delete set null,
  seen_count integer not null default 0,
  can_count integer not null default 0,
  cannot_count integer not null default 0,
  streak_can integer not null default 0,
  streak_cannot integer not null default 0,
  confidence_score integer not null default 0,
  last_result text check (last_result in ('relevant', 'not_yet', 'known', 'later', 'irrelevant')),
  next_review_step integer not null default 0,
  last_seen_step integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, node_id, clip_key),
  check (seen_count >= 0),
  check (can_count >= 0),
  check (cannot_count >= 0),
  check (streak_can >= 0),
  check (streak_cannot >= 0),
  check (confidence_score >= 0 and confidence_score <= 100)
);

create index if not exists training_clip_status_user_node_idx
on public.training_clip_status (user_id, node_id);

create index if not exists training_clip_status_user_due_idx
on public.training_clip_status (user_id, next_review_step);

alter table public.training_clip_status enable row level security;

create policy "training_clip_status_select_own" on public.training_clip_status
for select using (auth.uid() = user_id);

create policy "training_clip_status_insert_own" on public.training_clip_status
for insert with check (auth.uid() = user_id);

create policy "training_clip_status_update_own" on public.training_clip_status
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);
