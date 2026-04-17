-- FIX 1: Update clip assignment status from 'hidden' to 'assigned'
-- This makes clips visible in the API
UPDATE clip_archive 
SET assignment_status = 'assigned' 
WHERE assignment_status = 'hidden';

-- Check how many were updated
SELECT assignment_status, COUNT(*) 
FROM clip_archive 
GROUP BY assignment_status;

-- FIX 2: Create clip assignments for the gameplan nodes
-- First, let's see what clips we have
SELECT id, title, video_url, assignment_status
FROM clip_archive
WHERE video_url IS NOT NULL
  AND video_url != ''
LIMIT 10;

-- FIX 3: Assign clips to the 'Standing' node (technique-c3934120)
-- We'll assign some clips that match 'standing' in their title or description
INSERT INTO clip_assignments (clip_id, node_id, assignment_kind, role, display_order, created_at)
SELECT 
    ca.id,
    'technique-c3934120',  -- Standing node ID
    'node',
    'main_reference',
    ROW_NUMBER() OVER (ORDER BY ca.created_at),
    NOW()
FROM clip_archive ca
WHERE ca.video_url IS NOT NULL
  AND ca.video_url != ''
  AND ca.assignment_status != 'hidden'
  AND ca.assignment_status != 'archived'
  AND (
    ca.title ILIKE '%standing%'
    OR ca.search_query ILIKE '%standing%'
    OR ca.summary ILIKE '%standing%'
  )
ON CONFLICT (clip_id, node_id, assignment_kind) DO NOTHING;

-- FIX 4: Assign clips to other nodes based on keywords
-- For Closed Guard
INSERT INTO clip_assignments (clip_id, node_id, assignment_kind, role, display_order, created_at)
SELECT 
    ca.id,
    'technique-8c415ce9',  -- Closed Guard node ID
    'node',
    'main_reference',
    ROW_NUMBER() OVER (ORDER BY ca.created_at),
    NOW()
FROM clip_archive ca
WHERE ca.video_url IS NOT NULL
  AND ca.video_url != ''
  AND ca.assignment_status != 'hidden'
  AND ca.assignment_status != 'archived'
  AND (
    ca.title ILIKE '%guard%'
    OR ca.search_query ILIKE '%guard%'
    OR ca.summary ILIKE '%guard%'
    OR ca.title ILIKE '%half guard%'
  )
ON CONFLICT (clip_id, node_id, assignment_kind) DO NOTHING;

-- Check clip assignments created
SELECT node_id, COUNT(*) as clip_count
FROM clip_assignments
WHERE assignment_kind = 'node'
GROUP BY node_id;