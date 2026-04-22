-- Allow authenticated users to insert answers for their own questionnaire instances.
create policy "qa_insert_own" on questionnaire_answers for insert
with check (
  instance_id in (
    select id from questionnaire_instances where user_id = auth.uid()
  )
);
