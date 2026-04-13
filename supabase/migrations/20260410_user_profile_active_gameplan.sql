alter table public.user_profiles
  add column if not exists active_gameplan_id uuid null references public.gameplans(id) on delete set null;
