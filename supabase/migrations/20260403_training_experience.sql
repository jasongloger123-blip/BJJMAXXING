alter table if exists public.user_profiles
add column if not exists training_experience text;
