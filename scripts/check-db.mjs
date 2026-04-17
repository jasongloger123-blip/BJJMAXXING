import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://elvigdrebascpzbmuecf.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc'

async function checkDatabase() {
  console.log('=== DATABASE CHECK FOR jasongloger@googlemail.com ===\n')
  
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  
  // 1. Get user by email
  console.log('1. Looking up user in user_profiles...')
  const { data: users, error: userError } = await admin
    .from('user_profiles')
    .select('id, username, email, full_name')
    .eq('email', 'jasongloger@googlemail.com')
    .limit(1)
  
  if (userError) {
    console.log('   ERROR:', userError.message)
    return
  }
  
  if (!users || users.length === 0) {
    console.log('   ERROR: User not found!')
    return
  }
  
  const userId = users[0].id
  console.log('   User found:')
  console.log('     ID:', userId)
  console.log('     Username:', users[0].username)
  console.log('     Email:', users[0].email)
  console.log('     Full Name:', users[0].full_name)
  
  // 2. Check gameplan assignments
  console.log('\n2. Checking gameplan assignments...')
  const { data: assignments, error: assignmentError } = await admin
    .from('user_gameplan_assignments')
    .select('*')
    .eq('user_id', userId)
  
  if (assignmentError) {
    console.log('   ERROR:', assignmentError.message)
  } else if (!assignments || assignments.length === 0) {
    console.log('   WARNING: No gameplan assignments found!')
  } else {
    console.log('   Found', assignments.length, 'assignment(s):')
    assignments.forEach((a, i) => {
      console.log(`     Assignment ${i + 1}:`)
      console.log(`       ID: ${a.id}`)
      console.log(`       Gameplan ID: ${a.gameplan_id}`)
      console.log(`       Is Active: ${a.is_active}`)
      console.log(`       Has snapshot: ${!!a.plan_snapshot}`)
      if (a.plan_snapshot) {
        const snapshot = a.plan_snapshot
        console.log(`       Plan title: ${snapshot.title || 'N/A'}`)
        console.log(`       Nodes count: ${Object.keys(snapshot.nodes || {}).length}`)
        console.log(`       Current node: ${snapshot.unlockSummary?.currentNodeId || 'N/A'}`)
      }
    })
    
    const activeAssignment = assignments.find(a => a.is_active)
    if (!activeAssignment) {
      console.log('   WARNING: No ACTIVE assignment found!')
    }
  }
  
  // 3. Check if there are any clip_assignments
  console.log('\n3. Checking clip_assignments...')
  const { data: clipAssignments, error: clipError } = await admin
    .from('clip_assignments')
    .select('*')
    .limit(10)
  
  if (clipError) {
    console.log('   ERROR:', clipError.message)
  } else {
    console.log('   Found', clipAssignments?.length || 0, 'clip assignments total')
    if (clipAssignments && clipAssignments.length > 0) {
      console.log('   Sample assignment:', clipAssignments[0])
    }
  }
  
  // 4. Check clip_archive
  console.log('\n4. Checking clip_archive...')
  const { data: clips, error: clipsError } = await admin
    .from('clip_archive')
    .select('id, title, video_url')
    .limit(5)
  
  if (clipsError) {
    console.log('   ERROR:', clipsError.message)
  } else {
    console.log('   Found', clips?.length || 0, 'clips in archive')
    if (clips && clips.length > 0) {
      console.log('   Sample clip:', clips[0].title)
    }
  }
  
  console.log('\n=== CHECK COMPLETE ===')
}

checkDatabase().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
