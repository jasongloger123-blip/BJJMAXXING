-- Add social media URL columns to user_profiles table
alter table if exists public.user_profiles
add column if not exists youtube_url text,
add column if not exists instagram_url text,
add column if not exists tiktok_url text,
add column if not exists facebook_url text;

-- Add comment for documentation
comment on column public.user_profiles.youtube_url is 'User YouTube channel URL';
comment on column public.user_profiles.instagram_url is 'User Instagram profile URL';
comment on column public.user_profiles.tiktok_url is 'User TikTok profile URL';
comment on column public.user_profiles.facebook_url is 'User Facebook profile URL';
