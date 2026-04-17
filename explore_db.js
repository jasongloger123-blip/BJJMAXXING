const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://elvigdrebascpzbmuecf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc';

async function explore() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('Exploring gameplans table structure...');
  const { data: gameplan, error } = await admin
    .from('gameplans')
    .select('*')
    .limit(1)
    .single();
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('\nGameplan fields:', Object.keys(gameplan));
  console.log('\nFull gameplan data:');
  console.log(JSON.stringify(gameplan, null, 2));
  
  // Check nodes table
  console.log('\n\nExploring nodes table...');
  const { data: nodes, error: nodeError } = await admin
    .from('nodes')
    .select('*')
    .limit(3);
  
  if (!nodeError) {
    console.log('Nodes found:', nodes?.length || 0);
    if (nodes && nodes.length > 0) {
      console.log('Node fields:', Object.keys(nodes[0]));
      console.log('Sample node:', JSON.stringify(nodes[0], null, 2).substring(0, 500));
    }
  } else {
    console.log('Nodes error:', nodeError.message);
  }
}

explore().catch(console.error);
