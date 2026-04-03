alter table public.review_submissions
add column if not exists reviewer_feedback text,
add column if not exists reviewed_at timestamptz,
add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

create index if not exists review_submissions_status_created_idx
on public.review_submissions (status, created_at desc);
