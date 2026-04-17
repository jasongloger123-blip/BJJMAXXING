// Direct database check script
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://elvigdrebascpzbmuecf.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function checkDatabase() {
  console.log('Checking database for user jasongloger@googlemail.com...\n')
  
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  
  // 1. Get user by email
  const { data: users, error: userError } = await admin
    .from('user_profiles')
    .select('id, username, email')
    .eq('email', 'jasongloger@googlemail.com')
    .limit(1)
  
  if (userError) {
    console.log('Error fetching user:', userError.message)
    return
  }
  
  if (!users || users.length === 0) {
    console.log('User not found in user_profiles!')
    return
  }
  
  const userId = users[0].id
  console.log('User found:')
  console.log('  ID:', userId)
  console.log('  Username:', users[0].username)
  console.log('  Email:', users[0].email)
  
  // 2. Check gameplan assignments
  const { data: assignments, error: assignmentError } = await admin
    .from('user_gameplan_assignments')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
  
  if (assignmentError) {
    console.log('\nError fetching assignments:', assignmentError.message)
    return
  }
  
  console.log('\nActive gameplan assignments:', assignments?.length || 0)
  
  if (assignments && assignments.length > 0) {
    const assignment = assignments[0]
    console.log('  Assignment ID:', assignment.id)
    console.log('  Gameplan ID:', assignment.gameplan_id)
    console.log('  Is Active:', assignment.is_active)
    console.log('  Has plan_snapshot:', !!assignment.plan_snapshot)
    
    if (assignment.plan_snapshot) {
      const snapshot = assignment.plan_snapshot
      console.log('  Plan title:', snapshot.title)
      console.log('  Plan nodes count:', Object.keys(snapshot.nodes || {}).length)
      console.log('  Current node ID:', snapshot.unlockSummary ? snapshot.unlockSummary.currentNodeId : 'N/A')
    }
  } else {
    console.log('  No active gameplan assignment found!')
    console.log('  Checking ALL assignments for this user...')
    
    const { data: allAssignments } = await admin
      .from('user_gameplan_assignments')
      .select('*')
      .eq('user_id', userId)
    
    console.log('  Total assignments:', allAssignments?.length || 0)
    
    if (allAssignments && allAssignments.length > 0) {
      allAssignments.forEach((a, i) => {
        console.log(`    Assignment ${i + 1}:`)
        console.log(`      ID: ${a.id}`)
        console.log(`      Gameplan ID: ${a.gameplan_id}`)
        console.log(`      Is Active: ${a.is_active}`)
      })
    }
  }
}

checkDatabase().catch(console.error)
