alter table if exists public.user_profiles
add column if not exists youtube_url text,
add column if not exists tiktok_url text,
add column if not exists instagram_url text,
add column if not exists facebook_url text;
