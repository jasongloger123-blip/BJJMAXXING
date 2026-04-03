alter table public.user_profiles
add column if not exists gym_name text,
add column if not exists gym_place_id text,
add column if not exists gym_location text,
add column if not exists gym_types jsonb not null default '[]'::jsonb,
add column if not exists gym_source text not null default 'google',
add column if not exists gym_unlisted_name text,
add column if not exists gym_verified boolean not null default false;

create index if not exists user_profiles_gym_place_id_idx
on public.user_profiles (gym_place_id)
where gym_place_id is not null;
