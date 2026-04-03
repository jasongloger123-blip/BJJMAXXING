alter table if exists public.training_clip_events
drop constraint if exists training_clip_events_node_id_fkey;

alter table if exists public.clip_comments
drop constraint if exists clip_comments_node_id_fkey;
