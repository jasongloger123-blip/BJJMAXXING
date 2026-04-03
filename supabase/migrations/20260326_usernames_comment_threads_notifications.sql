alter table public.user_profiles
add column if not exists username text;

create unique index if not exists user_profiles_username_unique_idx
on public.user_profiles (lower(username))
where username is not null;

create table if not exists public.clip_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.clip_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists clip_comment_reactions_comment_idx
on public.clip_comment_reactions (comment_id);

create table if not exists public.clip_comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.clip_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  author_avatar_url text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists clip_comment_replies_comment_created_idx
on public.clip_comment_replies (comment_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_created_idx
on public.notifications (user_id, read, created_at desc);

alter table public.clip_comment_reactions enable row level security;
alter table public.clip_comment_replies enable row level security;
alter table public.notifications enable row level security;

create policy "clip_comment_reactions_public_read" on public.clip_comment_reactions
for select using (true);

create policy "clip_comment_reactions_insert_own" on public.clip_comment_reactions
for insert with check (auth.uid() = user_id);

create policy "clip_comment_reactions_update_own" on public.clip_comment_reactions
for update using (auth.uid() = user_id);

create policy "clip_comment_replies_public_read" on public.clip_comment_replies
for select using (true);

create policy "clip_comment_replies_insert_own" on public.clip_comment_replies
for insert with check (auth.uid() = user_id);

create policy "notifications_select_own" on public.notifications
for select using (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
for update using (auth.uid() = user_id);
