create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
  set email = excluded.email;

  insert into public.subscriptions (
    user_id,
    status,
    tier
  )
  values (
    new.id,
    'inactive',
    'free'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create unique index if not exists subscriptions_user_id_key
on public.subscriptions (user_id);

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.user_profiles (
  id,
  email,
  full_name
)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(users.email, ''), '@', 1)
  )
from auth.users as users
on conflict (id) do update
set email = excluded.email;

insert into public.subscriptions (
  user_id,
  status,
  tier
)
select
  users.id,
  'inactive',
  'free'
from auth.users as users
on conflict (user_id) do nothing;
