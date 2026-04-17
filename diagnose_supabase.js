const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://elvigdrebascpzbmuecf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTg0ODUsImV4cCI6MjA4OTg3NDQ4NX0.OXqaMqmUC3bqz0J05enMlhSTpqTb-9iQCVRf_DuiOOw';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc';

const ADMIN_EMAIL = 'jasongloger@googlemail.com';
const ADMIN_PASSWORD = 'QwErTer312';

async function diagnose() {
  console.log('='.repeat(60));
  console.log('BJJMAXXING CLIP LOADING DIAGNOSTIC');
  console.log('='.repeat(60));
  console.log();
  
  // Create admin client (service role - bypasses RLS)
  console.log('Connecting to Supabase with service role...');
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('✓ Connected');
  console.log();
  
  // Step 1: Check clip_archive table
  console.log('Step 1: Checking clip_archive table...');
  try {
    const { data: clips, error } = await admin
      .from('clip_archive')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else if (!clips || clips.length === 0) {
      console.log('⚠️  No clips found in clip_archive table!');
    } else {
      console.log(`✓ Found ${clips.length} clips in archive`);
      clips.forEach(clip => {
        console.log(`  - ${clip.title || 'N/A'} (ID: ${clip.id?.substring(0, 8)}...)`);
        console.log(`    Video URL: ${clip.video_url ? clip.video_url.substring(0, 50) : 'N/A'}...`);
      });
    }
  } catch (e) {
    console.log('❌ Exception:', e.message);
  }
  
  console.log();
  
  // Step 2: Count total clips
  console.log('Step 2: Counting total clips...');
  try {
    const { count, error } = await admin
      .from('clip_archive')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✓ Total clips in archive: ${count}`);
    }
  } catch (e) {
    console.log('❌ Exception:', e.message);
  }
  
  console.log();
  
  // Step 3: Check clip_assignments
  console.log('Step 3: Checking clip_assignments table...');
  try {
    const { data: assignments, error } = await admin
      .from('clip_assignments')
      .select('*')
      .limit(10);
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else if (!assignments || assignments.length === 0) {
      console.log('⚠️  No clip_assignments found!');
      console.log('   This could be why clips aren\'t showing - they need to be assigned to nodes.');
    } else {
      console.log(`✓ Found ${assignments.length} clip_assignments`);
      assignments.slice(0, 3).forEach(a => {
        console.log(`  - Clip ${a.clip_id?.substring(0, 8)}... -> Node ${a.node_id?.substring(0, 8)}...`);
      });
    }
  } catch (e) {
    console.log('❌ Exception:', e.message);
  }
  
  console.log();
  
  // Step 4: Check user_profiles for admin
  console.log('Step 4: Checking admin user profile...');
  try {
    const { data: profiles, error } = await admin
      .from('user_profiles')
      .select('*');
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      const adminProfile = profiles?.find(p => p.email === ADMIN_EMAIL);
      if (!adminProfile) {
        console.log(`⚠️  No profile found for admin user (${ADMIN_EMAIL})`);
      } else {
        console.log('✓ Admin profile found');
        console.log(`  ID: ${adminProfile.id}`);
        console.log(`  Active gameplan: ${adminProfile.active_gameplan_id || 'None'}`);
        console.log(`  Primary archetype: ${adminProfile.primary_archetype || 'None'}`);
      }
    }
  } catch (e) {
    console.log('❌ Exception:', e.message);
  }
  
  console.log();
  
  // Step 5: Check gameplans
  console.log('Step 5: Checking gameplans...');
  try {
    const { data: gameplans, error } = await admin
      .from('gameplans')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else if (!gameplans || gameplans.length === 0) {
      console.log('⚠️  No gameplans found!');
    } else {
      console.log(`✓ Found ${gameplans.length} gameplans`);
      gameplans.forEach(gp => {
        console.log(`  - ${gp.name || 'N/A'} (ID: ${gp.id?.substring(0, 8)}...)`);
        const unlock = gp.unlock_summary || {};
        console.log(`    Current node: ${unlock.currentNodeId || 'None'}`);
      });
    }
  } catch (e) {
    console.log('❌ Exception:', e.message);
  }
  
  console.log();
  console.log('='.repeat(60));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log();
  console.log('If clips exist but are not showing in the app, the issue is likely:');
  console.log();
  console.log('1. AUTH ISSUE: The start-queue API cannot identify the user');
  console.log('   - Cookie not being sent properly');
  console.log('   - Session not being recognized');
  console.log();
  console.log('2. ASSIGNMENT ISSUE: Clips exist but are not assigned to nodes');
  console.log('   - Need to assign clips via /admin/video-upload or /admin/outlierdb');
  console.log();
  console.log('3. GAMEPLAN ISSUE: User has no active gameplan or current node');
  console.log('   - Need to select/activate a gameplan');
  console.log();
  console.log('To test auth, run: npx playwright test e2e/diagnose-clip-loading.spec.ts --headed');
}

diagnose().catch(console.error);
