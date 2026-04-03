create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_url text not null,
  notes text,
  review_type text not null default 'manual',
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_submissions_user_created_idx
on public.review_submissions (user_id, created_at desc);

alter table public.review_submissions enable row level security;

create policy "review_submissions_select_own" on public.review_submissions
for select using (auth.uid() = user_id);

create policy "review_submissions_insert_own" on public.review_submissions
for insert with check (auth.uid() = user_id);
