import requests
import os

# Supabase credentials
SUPABASE_URL = "https://elvigdrebascpzbmuecf.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc"

# SQL to execute
SQL = """
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
create or replace function public.recalculate_user_techniques_learned_count()
returns trigger
language plpgsql
security definer
as $$
begin
    if TG_OP = 'UPDATE' then
        if OLD.can_count = NEW.can_count and OLD.cannot_count = NEW.cannot_count then
            return NEW;
        end if;
    end if;

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
"""

def apply_migration():
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {SERVICE_KEY}',
        'apikey': SERVICE_KEY
    }
    
    # Execute SQL using pg_execute function
    url = f"{SUPABASE_URL}/rest/v1/rpc/pg_execute"
    
    try:
        response = requests.post(url, headers=headers, json={"command": SQL})
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("Migration applied successfully!")
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error: {e}")
        
    # Alternative: Check if column exists first
    check_sql = """
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'techniques_learned_count';
    """
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/rpc/pg_execute"
        response = requests.post(url, headers=headers, json={"command": check_sql})
        print(f"\nColumn check status: {response.status_code}")
        print(f"Column check response: {response.text}")
    except Exception as e:
        print(f"Check error: {e}")

if __name__ == "__main__":
    apply_migration()
