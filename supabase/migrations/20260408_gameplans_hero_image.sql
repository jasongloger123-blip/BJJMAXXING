alter table if exists public.gameplans
add column if not exists hero_image_url text;

comment on column public.gameplans.hero_image_url is 'Optional hero image shown in admin builder and user gameplan header.';
