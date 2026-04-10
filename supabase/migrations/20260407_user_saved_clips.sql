create table if not exists public.user_saved_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  clip_id uuid not null references public.clip_archive (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, clip_id)
);

create index if not exists user_saved_clips_user_idx
on public.user_saved_clips (user_id, created_at desc);

create index if not exists user_saved_clips_clip_idx
on public.user_saved_clips (clip_id);

alter table public.user_saved_clips enable row level security;

create policy "user_saved_clips_select_own" on public.user_saved_clips
for select using (auth.uid() = user_id);

create policy "user_saved_clips_insert_own" on public.user_saved_clips
for insert with check (auth.uid() = user_id);

create policy "user_saved_clips_delete_own" on public.user_saved_clips
for delete using (auth.uid() = user_id);
