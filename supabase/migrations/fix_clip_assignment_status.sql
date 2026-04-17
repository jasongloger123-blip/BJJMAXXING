-- Fix clip assignment status - change 'hidden' to 'assigned' so clips are visible
UPDATE clip_archive 
SET assignment_status = 'assigned' 
WHERE assignment_status = 'hidden' 
  AND video_url IS NOT NULL 
  AND video_url != '';

-- Alternative: Show all clips regardless of assignment_status
-- If you want to show all clips to all users, remove the filter from the API

-- Check current status
SELECT assignment_status, COUNT(*) 
FROM clip_archive 
GROUP BY assignment_status;