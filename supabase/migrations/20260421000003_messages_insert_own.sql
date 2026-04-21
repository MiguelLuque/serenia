-- supabase/migrations/20260421000003_messages_insert_own.sql
--
-- Allow authenticated users to insert messages into their own conversations.
-- Previously inserts were service-role only; the chat API runs as the user's
-- authenticated client, so it needs an explicit INSERT policy.

create policy "messages_insert_own"
  on messages for insert
  with check (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );
