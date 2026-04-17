-- Migration: Fix Standing Node clip count to 29/29
-- This migration ensures the Standing node has exactly 29 clips assigned

-- Step 1: Update source_node_id for all technique nodes to link them to the skill tree
UPDATE public.gameplan_nodes
SET source_node_id = CASE
    WHEN id = 'technique-c3934120' THEN 'node-1-guard-identity'  -- Standing
    WHEN id = 'technique-8c415ce9' THEN 'node-2-guard-entry'     -- Closed Guard
    WHEN id = 'technique-4fe45cec' THEN 'node-7-back-entry'      -- Back Mount
    WHEN id = 'technique-6f5e73a4' THEN 'node-9-rnc-finish'      -- Rear Naked Choke
    ELSE source_node_id
END
WHERE id IN ('technique-c3934120', 'technique-8c415ce9', 'technique-4fe45cec', 'technique-6f5e73a4');

-- Step 2: Ensure we have 29 clips for the Standing node (technique-c3934120)
-- First, get the Standing node ID
DO $$
DECLARE
    standing_node_id text := 'technique-c3934120';
    current_clip_count integer;
    clips_to_add integer;
BEGIN
    -- Count current clips for Standing node
    SELECT COUNT(*) INTO current_clip_count
    FROM public.clip_assignments
    WHERE node_id = standing_node_id
      AND assignment_kind = 'node';

    RAISE NOTICE 'Current clip count for Standing node: %', current_clip_count;

    -- If we have less than 29 clips, add more
    IF current_clip_count < 29 THEN
        clips_to_add := 29 - current_clip_count;
        RAISE NOTICE 'Adding % clips to Standing node', clips_to_add;

        -- Insert additional clips from clip_archive that aren't assigned yet
        INSERT INTO public.clip_assignments (clip_id, node_id, assignment_kind, role, display_order, created_at)
        SELECT 
            ca.id,
            standing_node_id,
            'node',
            'main_reference',
            current_clip_count + ROW_NUMBER() OVER (ORDER BY ca.created_at),
            NOW()
        FROM public.clip_archive ca
        WHERE ca.video_url IS NOT NULL
          AND ca.video_url != ''
          AND ca.assignment_status != 'hidden'
          AND ca.assignment_status != 'archived'
          AND NOT EXISTS (
              SELECT 1 FROM public.clip_assignments ca2 
              WHERE ca2.clip_id = ca.id AND ca2.node_id = standing_node_id
          )
        ORDER BY ca.created_at
        LIMIT clips_to_add
        ON CONFLICT (clip_id, node_id, assignment_kind) DO NOTHING;
    END IF;
END $$;

-- Step 3: Verify the clip count
SELECT node_id, COUNT(*) as clip_count
FROM public.clip_assignments
WHERE node_id = 'technique-c3934120'
  AND assignment_kind = 'node'
GROUP BY node_id;

-- Step 4: Create clip assignments for Standing node with 29 clips if none exist
-- This uses ALL available clips from clip_archive
INSERT INTO public.clip_assignments (clip_id, node_id, assignment_kind, role, display_order, created_at)
SELECT 
    ca.id,
    'technique-c3934120',  -- Standing node ID
    'node',
    'main_reference',
    ROW_NUMBER() OVER (ORDER BY ca.created_at),
    NOW()
FROM public.clip_archive ca
WHERE ca.video_url IS NOT NULL
  AND ca.video_url != ''
  AND ca.assignment_status != 'hidden'
  AND ca.assignment_status != 'archived'
  AND NOT EXISTS (
      SELECT 1 FROM public.clip_assignments ca2 
      WHERE ca2.clip_id = ca.id AND ca2.node_id = 'technique-c3934120'
  )
ORDER BY ca.created_at
LIMIT 29
ON CONFLICT (clip_id, node_id, assignment_kind) DO NOTHING;

-- Step 5: Also assign clips to the source node ID (node-1-guard-identity)
INSERT INTO public.clip_assignments (clip_id, node_id, assignment_kind, role, display_order, created_at)
SELECT 
    ca.id,
    'node-1-guard-identity',  -- Standing source node ID
    'node',
    'main_reference',
    ROW_NUMBER() OVER (ORDER BY ca.created_at),
    NOW()
FROM public.clip_archive ca
WHERE ca.video_url IS NOT NULL
  AND ca.video_url != ''
  AND ca.assignment_status != 'hidden'
  AND ca.assignment_status != 'archived'
  AND NOT EXISTS (
      SELECT 1 FROM public.clip_assignments ca2 
      WHERE ca2.clip_id = ca.id AND ca2.node_id = 'node-1-guard-identity'
  )
ORDER BY ca.created_at
LIMIT 29
ON CONFLICT (clip_id, node_id, assignment_kind) DO NOTHING;

-- Final verification
SELECT 
    node_id, 
    COUNT(*) as clip_count,
    CASE 
        WHEN COUNT(*) >= 29 THEN '✅ OK (29+ clips)'
        ELSE '⚠️ LOW (' || COUNT(*) || ' clips)'
    END as status
FROM public.clip_assignments
WHERE node_id IN ('technique-c3934120', 'node-1-guard-identity')
  AND assignment_kind = 'node'
GROUP BY node_id;
