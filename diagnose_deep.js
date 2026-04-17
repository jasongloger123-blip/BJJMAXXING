const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://elvigdrebascpzbmuecf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc';

const ADMIN_USER_ID = '32d9e737-dc25-4306-a6dc-a5806fd429ea';
const ACTIVE_GAMEPLAN_ID = '29d64ad4-9def-42a7-8be3-128fa738790c';

async function deepDiagnose() {
  console.log('DEEP DIAGNOSTIC: Gameplan and Node Analysis');
  console.log('='.repeat(60));
  console.log();
  
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // 1. Get full gameplan details
  console.log('1. Checking full gameplan structure...');
  const { data: gameplan, error: gpError } = await admin
    .from('gameplans')
    .select('*')
    .eq('id', ACTIVE_GAMEPLAN_ID)
    .single();
  
  if (gpError) {
    console.log('❌ Error:', gpError.message);
    return;
  }
  
  console.log('Gameplan:', gameplan.name || 'Unnamed');
  console.log('Unlock summary:', JSON.stringify(gameplan.unlock_summary, null, 2));
  console.log('Main path:', gameplan.main_path ? `${gameplan.main_path.length} nodes` : 'None');
  console.log();
  
  // 2. Get gameplan nodes
  console.log('2. Checking gameplan_nodes...');
  const { data: nodes, error: nodeError } = await admin
    .from('gameplan_nodes')
    .select('*')
    .eq('gameplan_id', ACTIVE_GAMEPLAN_ID);
  
  if (nodeError) {
    console.log('❌ Error:', nodeError.message);
  } else {
    console.log(`Found ${nodes?.length || 0} gameplan nodes`);
    if (nodes && nodes.length > 0) {
      nodes.slice(0, 3).forEach(n => {
        console.log(`  - ${n.title} (ID: ${n.id?.substring(0, 8)}...)`);
      });
    }
  }
  console.log();
  
  // 3. Check clip_assignments for nodes
  console.log('3. Checking clip_assignments for gameplan nodes...');
  const nodeIds = nodes?.map(n => n.id) || [];
  if (nodeIds.length > 0) {
    const { data: assignments, error: assignError } = await admin
      .from('clip_assignments')
      .select('*, clip_archive!inner(*)')
      .in('node_id', nodeIds)
      .eq('assignment_kind', 'node');
    
    if (assignError) {
      console.log('❌ Error:', assignError.message);
    } else {
      console.log(`Found ${assignments?.length || 0} assignments for these nodes`);
    }
  }
  console.log();
  
  // 4. Check user_gameplan_assignments
  console.log('4. Checking user_gameplan_assignments...');
  const { data: userAssignment, error: uaError } = await admin
    .from('user_gameplan_assignments')
    .select('*')
    .eq('user_id', ADMIN_USER_ID)
    .eq('gameplan_id', ACTIVE_GAMEPLAN_ID)
    .maybeSingle();
  
  if (uaError) {
    console.log('❌ Error:', uaError.message);
  } else if (userAssignment) {
    console.log('User assignment found:');
    console.log('  Is active:', userAssignment.is_active);
    console.log('  Created:', userAssignment.created_at);
  } else {
    console.log('⚠️  No user_gameplan_assignment found!');
  }
  console.log();
  
  // 5. Check if current node is in a different state
  const currentNodeId = gameplan.unlock_summary?.currentNodeId;
  if (currentNodeId) {
    console.log('5. Current node details:', currentNodeId);
    const { data: currentNode, error: cnError } = await admin
      .from('gameplan_nodes')
      .select('*')
      .eq('id', currentNodeId)
      .maybeSingle();
    
    if (cnError) {
      console.log('❌ Error:', cnError.message);
    } else if (currentNode) {
      console.log('  Title:', currentNode.title);
      console.log('  Stage:', currentNode.stage);
    } else {
      console.log('⚠️  Current node not found in gameplan_nodes!');
    }
    
    // Check clip assignments for current node
    const { data: currentAssignments, error: caError } = await admin
      .from('clip_assignments')
      .select('*, clip_archive!inner(*)')
      .eq('node_id', currentNodeId)
      .eq('assignment_kind', 'node');
    
    if (!caError) {
      console.log(`  Clips assigned: ${currentAssignments?.length || 0}`);
    }
  } else {
    console.log('⚠️  CRITICAL: No currentNodeId in gameplan!');
    console.log('   This is why clips are not loading - start-queue needs a current node.');
  }
  
  console.log();
  console.log('='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));
  
  if (!currentNodeId) {
    console.log();
    console.log('ROOT CAUSE IDENTIFIED:');
    console.log('  The gameplan has NO current node set!');
    console.log();
    console.log('SOLUTION:');
    console.log('  1. Go to /admin/gameplans in the app');
    console.log('  2. Find and activate the gameplan');
    console.log('  3. Set a current node (first node in main path)');
    console.log('  4. Or run a SQL update to set currentNodeId');
    console.log();
    console.log('SQL FIX:');
    console.log(`  UPDATE gameplans`);
    console.log(`  SET unlock_summary = jsonb_set(`);
    console.log(`    unlock_summary,`);
    console.log(`    '{currentNodeId}', `);
    console.log(`    '"FIRST_NODE_ID"'`);
    console.log(`  )`);
    console.log(`  WHERE id = '${ACTIVE_GAMEPLAN_ID}';`);
  }
}

deepDiagnose().catch(console.error);
