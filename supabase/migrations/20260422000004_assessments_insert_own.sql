create policy "assessments_insert_own" on assessments for insert
with check (user_id = auth.uid());
