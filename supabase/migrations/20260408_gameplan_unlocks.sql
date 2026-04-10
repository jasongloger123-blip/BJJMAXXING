alter table if exists public.gameplan_nodes
add column if not exists unlock_phase text check (unlock_phase in ('core', 'expansion'));

alter table if exists public.gameplan_nodes
add column if not exists unlock_order integer;

alter table if exists public.gameplan_nodes
add column if not exists requires_validation boolean not null default false;

alter table if exists public.gameplan_nodes
add column if not exists unlock_parent_node_id text;

comment on column public.gameplan_nodes.unlock_phase is 'Unlock phase for staged gameplan progression.';
comment on column public.gameplan_nodes.unlock_order is 'Sequential unlock order within the unlock phase.';
comment on column public.gameplan_nodes.requires_validation is 'Whether this gameplan node must be validated before the next unlock.';
comment on column public.gameplan_nodes.unlock_parent_node_id is 'Optional parent gameplan node that gates this node unlock.';
