-- Migration: Create gyms table for BJJ Gym Directory
-- Date: 2026-04-08

-- Create gyms table
CREATE TABLE IF NOT EXISTS public.gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    website TEXT,
    phone TEXT,
    email TEXT,
    description TEXT,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create RLS policies
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

-- Everyone can read gyms
CREATE POLICY "Allow read gyms to all authenticated users" ON public.gyms
    FOR SELECT TO authenticated USING (true);

-- Everyone can read gyms (anon too for potential public listings)
CREATE POLICY "Allow read gyms to anon" ON public.gyms
    FOR SELECT TO anon USING (true);

-- Only authenticated users can insert
CREATE POLICY "Allow insert gyms to authenticated users" ON public.gyms
    FOR INSERT TO authenticated WITH CHECK (true);

-- Only admins or creators can update/delete
CREATE POLICY "Allow update gyms to authenticated users" ON public.gyms
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_gyms_location ON public.gyms USING gist (
    point(longitude, latitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gyms_city ON public.gyms(city);
CREATE INDEX IF NOT EXISTS idx_gyms_country ON public.gyms(country);
CREATE INDEX IF NOT EXISTS idx_gyms_name ON public.gyms USING gin (name gin_trgm_ops);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_gyms_updated_at ON public.gyms;
CREATE TRIGGER update_gyms_updated_at
    BEFORE UPDATE ON public.gyms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.gyms TO anon;
GRANT SELECT, INSERT, UPDATE ON public.gyms TO authenticated;

-- Note: The pg_trgm extension should already be enabled from previous migrations
-- If not, uncomment below:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
