alter table public.clip_archive
add column if not exists content_type text not null default 'technical_demo',
add column if not exists learning_phase text not null default 'core_mechanic',
add column if not exists target_archetype_ids text[] not null default '{}';

alter table public.clip_assignments
add column if not exists content_type text,
add column if not exists learning_phase text,
add column if not exists target_archetype_ids text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clip_archive_content_type_check'
  ) then
    alter table public.clip_archive
    add constraint clip_archive_content_type_check
    check (content_type in ('concept_explanation', 'technical_demo', 'drill', 'sparring_footage', 'competition_footage', 'mistake_analysis', 'counter_example'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clip_archive_learning_phase_check'
  ) then
    alter table public.clip_archive
    add constraint clip_archive_learning_phase_check
    check (learning_phase in ('overview', 'core_mechanic', 'entry', 'control', 'finish', 'common_mistake', 'troubleshooting', 'advanced'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clip_assignments_content_type_check'
  ) then
    alter table public.clip_assignments
    add constraint clip_assignments_content_type_check
    check (content_type is null or content_type in ('concept_explanation', 'technical_demo', 'drill', 'sparring_footage', 'competition_footage', 'mistake_analysis', 'counter_example'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clip_assignments_learning_phase_check'
  ) then
    alter table public.clip_assignments
    add constraint clip_assignments_learning_phase_check
    check (learning_phase is null or learning_phase in ('overview', 'core_mechanic', 'entry', 'control', 'finish', 'common_mistake', 'troubleshooting', 'advanced'));
  end if;
end $$;

create index if not exists clip_archive_taxonomy_idx
on public.clip_archive (content_type, learning_phase);

create index if not exists clip_assignments_taxonomy_idx
on public.clip_assignments (assignment_kind, node_id, role, learning_phase, display_order);

comment on column public.clip_archive.content_type is 'Pedagogical content type: concept explanation, technical demo, drill, sparring footage, competition footage, mistake analysis, or counter example.';
comment on column public.clip_archive.learning_phase is 'Pedagogical phase inside a technique: overview, core mechanic, entry, control, finish, common mistake, troubleshooting, or advanced.';
comment on column public.clip_archive.target_archetype_ids is 'Archetype IDs this clip is especially suited for.';
comment on column public.clip_assignments.content_type is 'Optional per-assignment override for clip content type.';
comment on column public.clip_assignments.learning_phase is 'Optional per-assignment override for clip learning phase.';
comment on column public.clip_assignments.target_archetype_ids is 'Optional per-assignment archetype targeting.';
