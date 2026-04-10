-- Create storage bucket for gameplan hero images

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gameplans',
  'gameplans',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view gameplan hero images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'gameplans');

CREATE POLICY "Authenticated users can upload gameplan hero images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'gameplans');

CREATE POLICY "Authenticated users can update gameplan hero images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'gameplans');

CREATE POLICY "Authenticated users can delete gameplan hero images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'gameplans');
