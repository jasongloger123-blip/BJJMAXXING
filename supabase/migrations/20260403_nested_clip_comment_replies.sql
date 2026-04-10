alter table if exists public.clip_comment_replies
add column if not exists parent_reply_id uuid references public.clip_comment_replies (id) on delete cascade;

create index if not exists clip_comment_replies_parent_created_idx
on public.clip_comment_replies (parent_reply_id, created_at asc);
