alter table public.external_technique_sources
add column if not exists video_format text;

alter table public.clip_archive
add column if not exists video_format text;

update public.external_technique_sources
set video_format = case
  when coalesce(video_url, source_url) ilike '%tiktok.com%' then 'tiktok'
  when coalesce(video_url, source_url) ilike '%instagram.com/reel/%' then 'instagram_reel'
  when coalesce(video_url, source_url) ilike '%instagram.com/p/%' then 'instagram_post'
  when coalesce(video_url, source_url) ilike '%/shorts/%' then 'youtube_shorts'
  when coalesce(video_url, source_url) ilike '%youtube.com%' or coalesce(video_url, source_url) ilike '%youtu.be%' then 'youtube'
  else 'external'
end
where video_format is null;

update public.clip_archive
set video_format = case
  when coalesce(video_url, source_url) ilike '%tiktok.com%' then 'tiktok'
  when coalesce(video_url, source_url) ilike '%instagram.com/reel/%' then 'instagram_reel'
  when coalesce(video_url, source_url) ilike '%instagram.com/p/%' then 'instagram_post'
  when coalesce(video_url, source_url) ilike '%/shorts/%' then 'youtube_shorts'
  when coalesce(video_url, source_url) ilike '%youtube.com%' or coalesce(video_url, source_url) ilike '%youtu.be%' then 'youtube'
  else 'external'
end
where video_format is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
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
    select 1
    from pg_constraint
    where conname = 'clip_archive_video_format_check'
  ) then
    alter table public.clip_archive
    add constraint clip_archive_video_format_check
    check (video_format in ('youtube', 'youtube_shorts', 'instagram_reel', 'instagram_post', 'tiktok', 'external'));
  end if;
end $$;

comment on column public.external_technique_sources.video_format is 'Precise clip format such as YouTube Shorts or Instagram Reel.';
comment on column public.clip_archive.video_format is 'Precise clip format such as YouTube Shorts or Instagram Reel.';
