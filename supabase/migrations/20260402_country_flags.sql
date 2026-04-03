create table if not exists public.country_flags (
  code text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

insert into public.country_flags (code, label)
values
  ('DE', 'Deutschland'),
  ('US', 'United States'),
  ('BR', 'Brasilien'),
  ('GB', 'Grossbritannien'),
  ('FR', 'Frankreich'),
  ('ES', 'Spanien'),
  ('IT', 'Italien'),
  ('PT', 'Portugal'),
  ('NL', 'Niederlande'),
  ('PL', 'Polen'),
  ('AT', 'Oesterreich'),
  ('CH', 'Schweiz'),
  ('SE', 'Schweden'),
  ('NO', 'Norwegen'),
  ('DK', 'Daenemark'),
  ('FI', 'Finnland'),
  ('IE', 'Irland'),
  ('MX', 'Mexiko'),
  ('CA', 'Kanada'),
  ('AU', 'Australien'),
  ('NZ', 'Neuseeland'),
  ('JP', 'Japan'),
  ('KR', 'Suedkorea'),
  ('CN', 'China'),
  ('IN', 'Indien'),
  ('AE', 'Vereinigte Arabische Emirate'),
  ('TR', 'Tuerkei'),
  ('TO', 'Tonga'),
  ('ZA', 'Suedafrika'),
  ('AR', 'Argentinien')
on conflict (code) do update set label = excluded.label;

alter table public.country_flags enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'country_flags'
      and policyname = 'country_flags_public_read'
  ) then
    create policy "country_flags_public_read" on public.country_flags
    for select using (true);
  end if;
end
$$;

alter table if exists public.user_profiles
add column if not exists nationality text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_nationality_fkey'
  ) then
    alter table public.user_profiles
    add constraint user_profiles_nationality_fkey
    foreign key (nationality) references public.country_flags(code)
    on update cascade
    on delete set null;
  end if;
end
$$;

create index if not exists user_profiles_nationality_idx
on public.user_profiles (nationality);
