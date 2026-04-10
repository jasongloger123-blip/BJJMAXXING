-- Check if gyms have coordinates
SELECT name, city, country, latitude, longitude 
FROM public.gyms;

-- If coordinates are NULL, update them with sample coordinates for testing
-- Gracie Barra Hannover coordinates (approximate)
UPDATE public.gyms 
SET latitude = 52.3705, longitude = 9.7332 
WHERE name LIKE '%Gracie Barra%' AND latitude IS NULL;

-- For any other gym without coordinates, set approximate Hannover coordinates
UPDATE public.gyms 
SET latitude = 52.3759, longitude = 9.7320 
WHERE latitude IS NULL AND longitude IS NULL;

-- Verify the updates
SELECT name, city, latitude, longitude 
FROM public.gyms;
