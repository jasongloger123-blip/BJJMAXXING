alter table public.user_profiles
  add column if not exists disabled_gameplan_ids text[] not null default '{}';
