alter table if exists public.progress
add column if not exists validated boolean not null default false;

alter table if exists public.progress
add column if not exists validated_at timestamptz;
