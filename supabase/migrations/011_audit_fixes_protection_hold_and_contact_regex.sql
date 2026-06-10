-- =====================================================================
-- 011_audit_fixes_protection_hold_and_contact_regex.sql
-- =====================================================================
-- Fixes found by the UI + backend audit:
--  (a) expire_stale_deals(): on a contractor-commitment lapse, also flag the
--      protection hold as refunded (was left 'held' after a full refund).
--  (b) tg_block_offplatform_contact(): tighten the phone regex so genuine
--      budget ranges like "12,000 - 15,000" are no longer false-flagged.
-- =====================================================================

create or replace function public.expire_stale_deals()
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  r record;
begin
  -- (a) homeowner payment window lapsed: pending_payment -> negotiating
  for r in
    select p.id, p.selected_offer_id
    from public.projects p
    where p.status = 'pending_payment'
      and p.payment_due_at is not null
      and p.payment_due_at < now()
  loop
    update public.offers set status = 'expired', expired_at = now()
      where id = r.selected_offer_id and status = 'payment_pending';
    update public.projects
      set status = 'negotiating', payment_status = 'unpaid',
          selected_offer_id = null, payment_due_at = null
      where id = r.id;
    insert into public.marketplace_events(project_id, offer_id, event_type, summary)
    values (r.id, r.selected_offer_id, 'payment_window_expired',
      'Homeowner payment window expired; project returned to negotiation');
  end loop;

  -- (b) contractor commitment window lapsed: paid -> negotiating + full refund
  for r in
    select p.id, p.awarded_offer_id, p.homeowner_id
    from public.projects p
    where p.status = 'paid'
      and p.contractor_fee_status = 'due'
      and p.contractor_commit_due_at is not null
      and p.contractor_commit_due_at < now()
  loop
    update public.offers set status = 'expired', expired_at = now()
      where id = r.awarded_offer_id;
    update public.payments set status = 'refunded', refunded_at = now()
      where project_id = r.id and status = 'held';
    update public.projects
      set status = 'negotiating', payment_status = 'refunded',
          protection_hold_status = 'refunded',
          contractor_fee_status = 'none', contractor_commit_due_at = null,
          selected_offer_id = null, awarded_offer_id = null, reopened_at = now()
      where id = r.id;
    insert into public.marketplace_events(project_id, offer_id, event_type, summary)
    values (r.id, r.awarded_offer_id, 'commitment_window_expired',
      'Contractor did not pay the commitment fee in time; homeowner refunded and project re-opened');
    insert into public.messages (conversation_id, sender_id, kind, content)
    select c.id, r.homeowner_id, 'system',
      'The selected contractor did not confirm this job by paying the commitment fee in time. Your payment has been fully refunded and the project is open again so you can choose another contractor.'
    from public.conversations c where c.project_id = r.id;
  end loop;
end $$;
revoke execute on function public.expire_stale_deals() from anon, public;
grant execute on function public.expire_stale_deals() to authenticated, service_role;

create or replace function public.tg_block_offplatform_contact()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_status text;
  v_content text := coalesce(new.content, '');
begin
  if coalesce(new.kind::text, 'text') <> 'text' then
    return new;
  end if;

  select p.status::text into v_status
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = new.conversation_id;

  if v_status in ('in_progress', 'completed') then
    return new;
  end if;

  -- Phone numbers: standard US formats, or a bare run of 10+ digits.
  if v_content ~ '(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})|(\d{10,})' then
    raise exception 'CONTACT_BLOCKED: Phone numbers cannot be shared until checkout is complete. Keep the deal on bidAI.';
  end if;
  if v_content ~* '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}' then
    raise exception 'CONTACT_BLOCKED: Email addresses cannot be shared until checkout is complete. Keep the deal on bidAI.';
  end if;
  if v_content ~* '(https?://|www\.)' then
    raise exception 'CONTACT_BLOCKED: External links cannot be shared until checkout is complete. Keep the deal on bidAI.';
  end if;
  if v_content ~* '(venmo|cashapp|cash app|zelle|paypal|telegram|whatsapp|\$[a-z][a-z0-9_]{2,})' then
    raise exception 'CONTACT_BLOCKED: Off-platform payment or messaging details cannot be shared until checkout is complete.';
  end if;

  return new;
end $$;
revoke execute on function public.tg_block_offplatform_contact() from anon, authenticated, public;
