import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createAdminClient()

  if (!supabase) {
    return NextResponse.json({ error: 'Admin client not initialized' }, { status: 500 })
  }

  try {
    // Check if bucket exists
    const { data: existingBuckets, error: listError } = await supabase
      .storage
      .listBuckets()

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    const bucketExists = existingBuckets?.some(bucket => bucket.name === 'techniques')

    if (bucketExists) {
      return NextResponse.json({ message: 'Bucket already exists' })
    }

    // Create the bucket
    const { data: bucket, error: createError } = await supabase
      .storage
      .createBucket('techniques', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
      })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Bucket created successfully',
      bucket
    })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
