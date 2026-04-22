create policy "qr_insert_own" on questionnaire_results for insert
with check (
  instance_id in (
    select id from questionnaire_instances where user_id = auth.uid()
  )
);

create policy "re_insert_own" on risk_events for insert
with check (user_id = auth.uid());
