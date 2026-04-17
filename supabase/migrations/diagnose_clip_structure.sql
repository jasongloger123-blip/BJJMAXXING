-- Diagnose the clip assignment structure
-- Check what node_ids exist in clip_assignments

SELECT DISTINCT node_id 
FROM clip_assignments 
WHERE assignment_kind = 'node'
LIMIT 20;

-- Check clip assignments that might match our gameplan nodes
SELECT ca.node_id, ca.clip_id, ca.role, ca.display_order,
       clip.title, clip.video_url, clip.assignment_status
FROM clip_assignments ca
JOIN clip_archive clip ON ca.clip_id = clip.id
WHERE ca.assignment_kind = 'node'
  AND clip.assignment_status != 'hidden'
  AND clip.assignment_status != 'archived'
LIMIT 20;

-- Check if there are any clips assigned to 'standing' or similar
SELECT ca.node_id, ca.clip_id, clip.title, clip.video_url
FROM clip_assignments ca
JOIN clip_archive clip ON ca.clip_id = clip.id
WHERE ca.node_id ILIKE '%standing%'
   OR ca.node_id ILIKE '%guard%'
   OR clip.title ILIKE '%standing%'
LIMIT 10;

-- Get all clip assignments with their video URLs
SELECT 
    ca.node_id,
    clip.id as clip_id,
    clip.title,
    clip.video_url,
    clip.assignment_status,
    ca.display_order
FROM clip_assignments ca
JOIN clip_archive clip ON ca.clip_id = clip.id
WHERE clip.video_url IS NOT NULL
  AND clip.video_url != ''
ORDER BY ca.node_id, ca.display_order
LIMIT 50;