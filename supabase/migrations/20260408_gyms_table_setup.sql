-- Create gyms table for BJJ Gym Directory
-- Run this in Supabase SQL Editor

-- Enable pg_trgm extension for text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

-- Enable RLS
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read gyms to all authenticated users" ON public.gyms
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read gyms to anon" ON public.gyms
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow insert gyms to authenticated users" ON public.gyms
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update gyms to authenticated users" ON public.gyms
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
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

-- Insert a sample gym (Gracie Barra Hannover)
INSERT INTO public.gyms (name, address, city, country, website, description, member_count)
VALUES (
    'Gracie Barra Hannover',
    'Lange Laube 25, 30159 Hannover',
    'Hannover',
    'Deutschland',
    'https://www.graciebarrahannover.de',
    'Brazilian Jiu-Jitsu Academy in Hannover',
    0
)
ON CONFLICT DO NOTHING;
