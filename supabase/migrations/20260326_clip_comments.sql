create table if not exists public.clip_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null,
  clip_key text not null,
  author_name text not null,
  author_avatar_url text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists clip_comments_clip_created_idx
on public.clip_comments (clip_key, created_at desc);

create index if not exists clip_comments_user_idx
on public.clip_comments (user_id, created_at desc);

alter table public.clip_comments enable row level security;

create policy "clip_comments_public_read" on public.clip_comments
for select using (true);

create policy "clip_comments_insert_own" on public.clip_comments
for insert with check (auth.uid() = user_id);
