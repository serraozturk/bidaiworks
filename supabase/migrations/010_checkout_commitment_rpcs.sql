-- =====================================================================
-- 010_checkout_commitment_rpcs.sql
-- =====================================================================
-- Shared checkout + commitment RPCs used by BOTH the web app and the
-- iOS/Android app so every platform drives the identical money state
-- machine. Deal-source agnostic: resolves the winning deal from
-- selected_offer_id / awarded_offer_id / awarded_quote_id.
-- =====================================================================

create or replace function public.homeowner_pay_project(
  p_project_id uuid, p_card_last4 text default null)
returns text language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_project public.projects%rowtype;
  v_offer public.offers%rowtype;
  v_quote public.quotes%rowtype;
  v_amount numeric;
  v_contractor uuid;
  v_offer_id uuid;
  v_conv uuid;
  v_protection numeric;
  v_fee numeric;
  v_total numeric;
  v_now timestamptz := now();
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;
  if v_project.homeowner_id <> auth.uid() then
    raise exception 'Only the homeowner can pay for this project';
  end if;
  if v_project.status not in ('awarded', 'pending_payment') then
    raise exception 'This project is not ready for payment (status %)', v_project.status;
  end if;
  if v_project.status = 'pending_payment'
     and v_project.payment_due_at is not null
     and v_project.payment_due_at < v_now then
    raise exception 'The payment window has expired. Please re-accept an offer.';
  end if;

  select * into v_offer from public.offers
   where id = coalesce(v_project.selected_offer_id, v_project.awarded_offer_id);
  if found then
    v_amount := v_offer.amount;
    v_offer_id := v_offer.id;
    v_conv := v_offer.conversation_id;
    v_contractor := case when v_offer.sender_role = 'contractor'
                         then v_offer.sender_id else v_offer.recipient_id end;
  else
    select * into v_quote from public.quotes where id = v_project.awarded_quote_id;
    if not found then raise exception 'No accepted offer or quote to pay'; end if;
    v_amount := v_quote.amount;
    v_contractor := v_quote.contractor_id;
    select id into v_conv from public.conversations
     where project_id = p_project_id and contractor_id = v_contractor limit 1;
  end if;

  if v_contractor is null then raise exception 'Contractor not found for this deal'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Invalid deal amount'; end if;

  v_protection := coalesce(v_project.protection_hold_amount, 300);
  v_fee := round(v_amount * 0.08, 2);
  v_total := v_amount + v_protection;

  update public.projects set
    status = 'paid', payment_status = 'paid',
    selected_offer_id = coalesce(v_offer_id, selected_offer_id),
    awarded_offer_id = coalesce(v_offer_id, awarded_offer_id),
    protection_hold_amount = v_protection, protection_hold_status = 'held',
    protection_hold_paid_at = v_now, paid_at = v_now, payment_due_at = null,
    contractor_fee_amount = v_fee, contractor_fee_status = 'due',
    contractor_commit_due_at = v_now + interval '48 hours'
  where id = p_project_id;

  if v_offer_id is not null then
    update public.offers set status = 'accepted', accepted_at = v_now, responded_at = v_now
      where id = v_offer_id;
    update public.offers set status = 'rejected', responded_at = v_now
      where project_id = p_project_id and id <> v_offer_id
        and status in ('pending', 'countered', 'payment_pending');
  end if;

  insert into public.payments(
    project_id, offer_id, payer_id, payee_id, total_amount, project_amount,
    protection_hold_amount, deposit_amount, deposit_pct, contractor_fee_amount,
    contractor_payout_amount, platform_fee_amount, method, status, card_last4,
    payment_reference, notes, held_at, created_at)
  values (
    p_project_id, v_offer_id, auth.uid(), v_contractor, v_total, v_amount,
    v_protection, v_amount, 100, v_fee,v_amount, v_fee, 'card', 'held',
    p_card_last4,
    'BIDAI-' || substr(p_project_id::text, 1, 8) || '-' || to_char(v_now, 'YYYYMMDDHH24MISS'),
    'Homeowner checkout (test mode). Funds held in escrow.', v_now, v_now);

  if v_conv is not null then
    insert into public.messages(conversation_id, sender_id, kind, offer_id, content)
    values (v_conv, auth.uid(), 'system', v_offer_id,
      'Homeowner payment confirmed and held in bidAI escrow. The contractor now has 48 hours to confirm this job by paying the commitment fee. Direct chat unlocks once the contractor commits.');
    update public.conversations set last_message_at = v_now where id = v_conv;
  end if;

  return 'ok';
end $$;
revoke execute on function public.homeowner_pay_project(uuid, text) from anon, public;
grant execute on function public.homeowner_pay_project(uuid, text) to authenticated;

create or replace function public.contractor_pay_commitment(p_project_id uuid)
returns text language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_project public.projects%rowtype;
  v_offer public.offers%rowtype;
  v_quote public.quotes%rowtype;
  v_contractor uuid;
  v_amount numeric;
  v_conv uuid;
  v_offer_id uuid;
  v_fee numeric;
  v_now timestamptz := now();
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;
  if v_project.status = 'in_progress' then return 'already_active'; end if;
  if v_project.status <> 'paid' or coalesce(v_project.contractor_fee_status, '') <> 'due' then
    raise exception 'This job is not awaiting a commitment payment';
  end if;
  if v_project.contractor_commit_due_at is not null
     and v_project.contractor_commit_due_at < v_now then
    raise exception 'The 48-hour commitment window has expired';
  end if;

  select * into v_offer from public.offers
   where id = coalesce(v_project.awarded_offer_id, v_project.selected_offer_id);
  if found then
    v_contractor := case when v_offer.sender_role = 'contractor'
                         then v_offer.sender_id else v_offer.recipient_id end;
    v_amount := v_offer.amount;
    v_conv := v_offer.conversation_id;
    v_offer_id := v_offer.id;
  else
    select * into v_quote from public.quotes where id = v_project.awarded_quote_id;
    if not found then raise exception 'No awarded deal found'; end if;
    v_contractor := v_quote.contractor_id;
    v_amount := v_quote.amount;
    select id into v_conv from public.conversations
     where project_id = p_project_id and contractor_id = v_contractor limit 1;
  end if;

  if v_contractor <> auth.uid() then
    raise exception 'This job was awarded to a different contractor';
  end if;

  v_fee := coalesce(v_project.contractor_fee_amount, round(v_amount * 0.08, 2));

  update public.projects set
    status = 'in_progress', contractor_fee_status = 'paid',
    contractor_fee_paid_at = v_now, contractor_fee_amount = v_fee
  where id = p_project_id;

  update public.payments set
  contractor_fee_amount = v_fee,
  platform_fee_amount = v_fee,
  contractor_payout_amount = coalesce(project_amount, v_amount),
  notes = 'Contractor commitment fee paid (test mode). Job activated.'
where project_id = p_project_id and status = 'held';

  insert into public.marketplace_events(
    project_id, conversation_id, offer_id, actor_id, actor_role,
    event_type, summary, detail)
  values (p_project_id, v_conv, v_offer_id, auth.uid(), 'contractor',
    'contractor_committed', 'Contractor paid the commitment fee and claimed the job',
    jsonb_build_object('fee', v_fee, 'amount', v_amount));

  if v_conv is not null then
    insert into public.messages(conversation_id, sender_id, kind, offer_id, content)
    values (v_conv, auth.uid(), 'system', v_offer_id,
      'Contractor confirmed this job by paying the commitment fee. The project is now active and direct chat is open.');
    update public.conversations set last_message_at = v_now where id = v_conv;
  end if;

  return 'ok';
end $$;
revoke execute on function public.contractor_pay_commitment(uuid) from anon, public;
grant execute on function public.contractor_pay_commitment(uuid) to authenticated;
