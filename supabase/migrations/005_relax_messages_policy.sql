-- =====================================================================
-- 005_relax_messages_policy.sql
-- =====================================================================
-- Chat stays open even after the deal is locked. Hard lock applies only
-- to offers (see 004_payments_escrow_hardlock.sql). This lets the two
-- parties keep coordinating logistics, scheduling, deposit timing, etc.
-- after the project is awarded/paid/in_progress/completed.
-- =====================================================================

drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.homeowner_id or auth.uid() = c.contractor_id)
    )
  );
