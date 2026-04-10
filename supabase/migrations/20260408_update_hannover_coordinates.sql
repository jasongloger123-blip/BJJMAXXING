-- Add coordinates to Gracie Barra Hannover
-- Run this in Supabase SQL Editor

UPDATE public.gyms 
SET 
  latitude = 52.3705,
  longitude = 9.7332
WHERE name = 'Gracie Barra Hannover';

-- Verify the update
SELECT name, city, latitude, longitude FROM public.gyms WHERE name = 'Gracie Barra Hannover';
