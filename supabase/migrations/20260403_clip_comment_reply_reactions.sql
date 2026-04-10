create table if not exists public.clip_comment_reply_reactions (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.clip_comment_replies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (reply_id, user_id)
);

create index if not exists clip_comment_reply_reactions_reply_idx
on public.clip_comment_reply_reactions (reply_id);

alter table public.clip_comment_reply_reactions enable row level security;

create policy "clip_comment_reply_reactions_public_read" on public.clip_comment_reply_reactions
for select using (true);

create policy "clip_comment_reply_reactions_insert_own" on public.clip_comment_reply_reactions
for insert with check (auth.uid() = user_id);

create policy "clip_comment_reply_reactions_update_own" on public.clip_comment_reply_reactions
for update using (auth.uid() = user_id);
