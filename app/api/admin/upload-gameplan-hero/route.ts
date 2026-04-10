import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function ensureGameplansBucket(supabase: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    return { error: listError }
  }

  const bucketExists = buckets?.some((bucket) => bucket.name === 'gameplans')
  if (bucketExists) {
    return { error: null }
  }

  const { error: createError } = await supabase.storage.createBucket('gameplans', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  })

  return { error: createError }
}

export async function POST(request: Request) {
  const supabase = createAdminClient()

  if (!supabase) {
    return NextResponse.json({ error: 'Admin client not initialized' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const gameplanId = formData.get('gameplanId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!gameplanId) {
      return NextResponse.json({ error: 'No gameplanId provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Nur Bilddateien sind erlaubt.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maximale Dateigroesse ist 5MB.' }, { status: 400 })
    }

    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${gameplanId}-${Date.now()}.${extension}`
    const filePath = `heroes/${fileName}`

    let { error: uploadError } = await supabase.storage
      .from('gameplans')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError?.message?.toLowerCase().includes('bucket not found')) {
      const bucketResult = await ensureGameplansBucket(supabase)
      if (bucketResult.error) {
        return NextResponse.json({ error: `Bucket konnte nicht erstellt werden: ${bucketResult.error.message}` }, { status: 500 })
      }

      const retry = await supabase.storage
        .from('gameplans')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      uploadError = retry.error
    }

    if (uploadError) {
      return NextResponse.json({ error: `Upload fehlgeschlagen: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gameplans')
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
