create policy "review_submissions_update_own_resubmission" on public.review_submissions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
