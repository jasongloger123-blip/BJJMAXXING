-- Create storage bucket for technique images
-- This migration creates the 'techniques' bucket for image uploads

-- Enable storage if not already enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS "supabase-storage";

-- Insert the bucket into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'techniques',
    'techniques',
    true,
    5242880,  -- 5MB in bytes
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[];

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'techniques');

-- Create policy to allow public read access
CREATE POLICY "Allow public read" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'techniques');

-- Create policy to allow authenticated users to update their own files
CREATE POLICY "Allow authenticated updates" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'techniques');

-- Create policy to allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated deletes" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'techniques');
