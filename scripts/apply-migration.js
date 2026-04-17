const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc'

const SQL = `
-- Migration: Add techniques_learned_count to user_profiles with automatic counting via trigger
-- Created: 2026-04-17

-- 1. Add the new column for tracking learned techniques count
alter table public.user_profiles 
add column if not exists techniques_learned_count integer not null default 0;

-- 2. Add comment for documentation
comment on column public.user_profiles.techniques_learned_count is 'Anzahl der Clips, die der User als "Kann ich" markiert hat';

-- 3. Create index for fast queries
create index if not exists user_profiles_techniques_learned_count_idx 
on public.user_profiles (techniques_learned_count desc);

-- 4. Create function to automatically update the count when training_clip_status changes
-- This trigger fires whenever can_count changes and recalculates the total

create or replace function public.recalculate_user_techniques_learned_count()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Only recalculate when can_count or cannot_count changes (not on every update)
    if TG_OP = 'UPDATE' then
        if OLD.can_count = NEW.can_count and OLD.cannot_count = NEW.cannot_count then
            return NEW;
        end if;
    end if;

    -- Recalculate the total learned count for this user
    -- Count each unique clip_key where can_count > 0
    update public.user_profiles
    set techniques_learned_count = (
        select count(distinct clip_key)
        from public.training_clip_status
        where user_id = NEW.user_id
        and can_count > 0
    )
    where id = NEW.user_id;

    return NEW;
end;
$$;

-- 5. Create the trigger on training_clip_status table
drop trigger if exists on_training_clip_status_update on public.training_clip_status;

create trigger on_training_clip_status_update
    after insert or update of can_count, cannot_count on public.training_clip_status
    for each row
    execute function public.recalculate_user_techniques_learned_count();

-- 6. Backfill existing data for all users
-- This counts all existing "Kann ich" entries and updates user_profiles

update public.user_profiles
set techniques_learned_count = subquery.learned_count
from (
    select 
        user_id,
        count(distinct clip_key) as learned_count
    from public.training_clip_status
    where can_count > 0
    group by user_id
) as subquery
where public.user_profiles.id = subquery.user_id;

-- 7. Set techniques_learned_count to 0 for users with no training_clip_status entries yet
update public.user_profiles
set techniques_learned_count = 0
where techniques_learned_count is null;
`

async function executeSql() {
  const response = await fetch('https://elvigdrebascpzbmuecf.supabase.co/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY
    },
    body: JSON.stringify({ sql: SQL })
  })
  
  const result = await response.json()
  console.log('Migration result:', result)
}

executeSql().catch(console.error)
