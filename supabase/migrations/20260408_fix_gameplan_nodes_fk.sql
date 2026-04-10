-- Fix foreign key constraint on gameplan_nodes.source_node_id
-- The constraint references public.nodes but the value might not exist
-- We'll drop the constraint and allow any value

alter table public.gameplan_nodes drop constraint if exists gameplan_nodes_source_node_id_fkey;

-- Add a comment to document this field
comment on column public.gameplan_nodes.source_node_id is 'Optional reference to a source node ID. No foreign key constraint enforced.';
