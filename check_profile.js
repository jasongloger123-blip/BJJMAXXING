const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://elvigdrebascpzbmuecf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc';

const ADMIN_USER_ID = '32d9e737-dc25-4306-a6dc-a5806fd429ea';

async function checkProfile() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('Checking user_profiles for admin...');
  const { data: profile, error } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', ADMIN_USER_ID)
    .single();
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('\nAdmin profile:');
  console.log(JSON.stringify(profile, null, 2));
  
  // Check if active_gameplan_id is set
  if (!profile.active_gameplan_id) {
    console.log('\n⚠️  CRITICAL: No active_gameplan_id set!');
    console.log('This is why clips aren\'t loading - the app needs an active gameplan.');
  }
}

checkProfile().catch(console.error);
