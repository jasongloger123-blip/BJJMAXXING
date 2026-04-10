import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createAdminClient()

  if (!supabase) {
    return NextResponse.json({ error: 'Admin client not initialized' }, { status: 500 })
  }

  try {
    const { filePath } = await request.json()

    if (!filePath) {
      return NextResponse.json({ error: 'No filePath provided' }, { status: 400 })
    }

    // Delete mit Admin-Client (bypasses RLS)
    const { error } = await supabase.storage
      .from('techniques')
      .remove([`techniques/${filePath}`])

    if (error) {
      console.error('Storage delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
