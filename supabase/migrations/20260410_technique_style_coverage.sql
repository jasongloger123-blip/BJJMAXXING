alter table public.external_technique_sources
add column if not exists video_format text,
add column if not exists style_coverage text not null default 'both';

alter table public.clip_archive
add column if not exists video_format text,
add column if not exists style_coverage text not null default 'both';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'external_technique_sources_video_format_check'
  ) then
    alter table public.external_technique_sources
    add constraint external_technique_sources_video_format_check
    check (video_format in ('youtube', 'youtube_shorts', 'instagram_reel', 'instagram_post', 'tiktok', 'external'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clip_archive_video_format_check'
  ) then
    alter table public.clip_archive
    add constraint clip_archive_video_format_check
    check (video_format in ('youtube', 'youtube_shorts', 'instagram_reel', 'instagram_post', 'tiktok', 'external'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'external_technique_sources_style_coverage_check'
  ) then
    alter table public.external_technique_sources
    add constraint external_technique_sources_style_coverage_check
    check (style_coverage in ('gi', 'nogi', 'both'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clip_archive_style_coverage_check'
  ) then
    alter table public.clip_archive
    add constraint clip_archive_style_coverage_check
    check (style_coverage in ('gi', 'nogi', 'both'));
  end if;
end $$;

comment on column public.external_technique_sources.style_coverage is 'Indicates whether the imported clip is Gi, No-Gi or applies to both.';
comment on column public.clip_archive.style_coverage is 'Indicates whether the archived clip is Gi, No-Gi or applies to both.';
