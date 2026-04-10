import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createAdminClient()

  if (!supabase) {
    return NextResponse.json({ error: 'Admin client not initialized' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const techniqueId = formData.get('techniqueId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!techniqueId) {
      return NextResponse.json({ error: 'No techniqueId provided' }, { status: 400 })
    }

    // Validierung
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Nur Bilddateien sind erlaubt.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maximale Dateigröße ist 5MB.' }, { status: 400 })
    }

    // Eindeutiger Dateiname
    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${techniqueId}-${Date.now()}.${extension}`
    const filePath = `techniques/${fileName}`

    // Upload mit Admin-Client (bypasses RLS)
    const { error: uploadError } = await supabase.storage
      .from('techniques')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: `Upload fehlgeschlagen: ${uploadError.message}` }, { status: 500 })
    }

    // Öffentliche URL generieren
    const { data: { publicUrl } } = supabase.storage
      .from('techniques')
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
