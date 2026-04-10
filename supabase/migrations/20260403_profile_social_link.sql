alter table if exists public.user_profiles
add column if not exists social_link text;
