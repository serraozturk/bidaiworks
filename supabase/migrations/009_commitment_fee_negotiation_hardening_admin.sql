-- =====================================================================
-- 009_commitment_fee_negotiation_hardening_admin.sql
-- =====================================================================
-- Adds, all idempotent / safe to re-run:
--   1. projects.contractor_fee_* columns      - contractor commitment fee
--   2. uq_offers_one_active_per_project       - one active deal per project
--   3. hardened "offers send" RLS policy      - lock deal once it leaves
--                                               negotiation (no new offers)
--   4. marketplace_events + audit triggers    - full negotiation audit trail
--   5. tg_block_offplatform_contact trigger   - no phone/email/links/payment
--                                               handles in chat before checkout
--   6. expire_stale_deals()                   - lazy expiry of stale payment
--                                               and commitment windows
--   7. reserve_offer_for_payment()            - hardened: clean errors, never
--                                               leaves the homeowner stuck
--   8. backfill: existing 'paid' projects are grandfathered to 'in_progress'
--      with the commitment fee marked paid (so live deals are not disrupted)
--
-- Project lifecycle after this migration:
--   draft -> open -> negotiating -> pending_payment (homeowner must pay)
--         -> paid (homeowner paid; contractor must pay 8% commitment fee)
--         -> in_progress (contractor committed; chat + active job unlocked)
--         -> completed
-- =====================================================================

-- 1) projects: contractor commitment-fee lifecycle -------------------
alter table public.projects
  add column if not exists contractor_fee_amount    numeric(10,2),
  add column if not exists contractor_fee_status    text not null default 'none',
  add column if not exists contractor_fee_paid_at   timestamptz,
  add column if not exists contractor_commit_due_at timestamptz,
  add column if not exists reopened_at              timestamptz;

comment on column public.projects.contractor_fee_status is
  'none | due | paid - contractor commitment-fee state for the awarded deal';

-- 2) one active offer per project (hard DB guarantee) ----------------
create unique index if not exists uq_offers_one_active_per_project
  on public.offers (project_id)
  where status in ('payment_pending', 'accepted');

-- 3) negotiation lock: no new offers once a deal leaves negotiation --
drop policy if exists "offers send" on public.offers;
create policy "offers send" on public.offers
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from public.profiles pr
                where pr.id = auth.uid() and pr.role = sender_role)
    and exists (select 1 from public.projects p
                where p.id = project_id
                  and p.status::text in ('open','in_review','quoted','negotiating'))
    and (
      conversation_id is null
      or exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and auth.uid() in (c.homeowner_id, c.contractor_id))
    )
  );

-- 4) marketplace_events: full negotiation audit trail ----------------
create table if not exists public.marketplace_events (
  id uuid primary key default uuid_generate_v4(),
  project_id      uuid references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  offer_id        uuid references public.offers(id) on delete set null,
  actor_id        uuid references public.profiles(id) on delete set null,
  actor_role      text,
  event_type      text not null,
  summary         text,
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_mevents_project on public.marketplace_events(project_id, created_at desc);
create index if not exists idx_mevents_type    on public.marketplace_events(event_type, created_at desc);
create index if not exists idx_mevents_created on public.marketplace_events(created_at desc);

alter table public.marketplace_events enable row level security;
-- intentionally no policy: only the service-role admin client may read it.

create or replace function public.tg_audit_offer()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  begin
    if tg_op = 'INSERT' then
      insert into public.marketplace_events
        (project_id, conversation_id, offer_id, actor_id, actor_role, event_type, summary, detail)
      values (new.project_id, new.conversation_id, new.id, new.sender_id, new.sender_role::text,
        'offer_sent', initcap(new.sender_role::text) || ' sent an offer',
        jsonb_build_object('amount', new.amount, 'timeline_days', new.timeline_days,
                           'kind', new.kind, 'status', new.status));
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      insert into public.marketplace_events
        (project_id, conversation_id, offer_id, event_type, summary, detail)
      values (new.project_id, new.conversation_id, new.id,
        'offer_' || new.status,
        'Offer moved from ' || old.status || ' to ' || new.status,
        jsonb_build_object('amount', new.amount, 'old_status', old.status, 'new_status', new.status));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
revoke execute on function public.tg_audit_offer() from anon, authenticated, public;
drop trigger if exists trg_audit_offer on public.offers;
create trigger trg_audit_offer after insert or update on public.offers
  for each row execute function public.tg_audit_offer();

create or replace function public.tg_audit_project()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  begin
    if new.status is distinct from old.status then
      insert into public.marketplace_events
        (project_id, actor_id, event_type, summary, detail)
      values (new.id, new.homeowner_id,
        'project_' || new.status::text,
        'Project status: ' || old.status::text || ' -> ' || new.status::text,
        jsonb_build_object('old_status', old.status, 'new_status', new.status,
                           'payment_status', new.payment_status,
                           'contractor_fee_status', new.contractor_fee_status));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
revoke execute on function public.tg_audit_project() from anon, authenticated, public;
drop trigger if exists trg_audit_project on public.projects;
create trigger trg_audit_project after update on public.projects
  for each row execute function public.tg_audit_project();

create or replace function public.tg_audit_payment()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  begin
    if tg_op = 'INSERT' then
      insert into public.marketplace_events
        (project_id, offer_id, actor_id, actor_role, event_type, summary, detail)
      values (new.project_id, new.offer_id, new.payer_id, 'homeowner',
        'payment_recorded', 'Payment recorded and held in escrow',
        jsonb_build_object('total_amount', new.total_amount, 'status', new.status,
                           'project_amount', new.project_amount));
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      insert into public.marketplace_events
        (project_id, offer_id, event_type, summary, detail)
      values (new.project_id, new.offer_id,
        'payment_' || new.status::text, 'Payment ' || new.status::text,
        jsonb_build_object('total_amount', new.total_amount,
                           'old_status', old.status, 'new_status', new.status));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
revoke execute on function public.tg_audit_payment() from anon, authenticated, public;
drop trigger if exists trg_audit_payment on public.payments;
create trigger trg_audit_payment after insert or update on public.payments
  for each row execute function public.tg_audit_payment();

-- 5) block off-platform contact in free-text chat before checkout ----
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

  if v_content ~ '(\+?\d[\d\s().\-]{6,}\d)' then
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
drop trigger if exists trg_block_offplatform_contact on public.messages;
create trigger trg_block_offplatform_contact before insert on public.messages
  for each row execute function public.tg_block_offplatform_contact();

-- 6) lazy expiry of stale payment / commitment windows ---------------
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

  -- (b) contractor commitment window lapsed: paid -> negotiating + refund
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

-- 7) harden reserve_offer_for_payment (clean errors, auto-reset lapsed)
create or replace function public.reserve_offer_for_payment(
  p_offer_id uuid, p_payment_window_minutes integer default 60)
returns table(project_id uuid, offer_id uuid, payment_due_at timestamptz)
language plpgsql security definer set search_path to 'public', 'pg_catalog' as $$
declare
  v_offer public.offers%rowtype;
  v_project public.projects%rowtype;
  v_conversation public.conversations%rowtype;
  v_due_at timestamptz;
begin
  select * into v_offer from public.offers where id = p_offer_id;
  if not found then raise exception 'Offer not found'; end if;

  select * into v_project from public.projects where id = v_offer.project_id;
  if not found then raise exception 'Project not found'; end if;

  select * into v_conversation from public.conversations where id = v_offer.conversation_id;
  if not found then raise exception 'Conversation not found'; end if;

  if auth.uid() <> v_conversation.homeowner_id and auth.uid() <> v_conversation.contractor_id then
    raise exception 'Only conversation participants can reserve this offer';
  end if;
  if auth.uid() = v_offer.sender_id then
    raise exception 'You cannot accept your own offer';
  end if;

  -- a lapsed payment reservation auto-resets so the homeowner is never stuck
  if v_project.status = 'pending_payment'
     and v_project.payment_due_at is not null
     and v_project.payment_due_at < now() then
    update public.offers set status = 'expired', expired_at = now()
      where id = v_project.selected_offer_id and status = 'payment_pending';
    update public.projects
      set status = 'negotiating', payment_status = 'unpaid',
          selected_offer_id = null, payment_due_at = null
      where id = v_project.id;
    select * into v_project from public.projects where id = v_offer.project_id;
  end if;

  if v_project.status in ('paid', 'in_progress', 'completed', 'cancelled') then
    raise exception 'This project already has a confirmed contractor and is no longer open for payment.';
  end if;
  if v_project.status = 'pending_payment'
     and v_project.selected_offer_id is distinct from p_offer_id then
    raise exception 'Another offer on this project is already reserved for payment.';
  end if;
  if v_offer.status not in ('pending', 'countered', 'payment_pending') then
    raise exception 'This offer can no longer be reserved for payment.';
  end if;

  v_due_at := now() + make_interval(mins => p_payment_window_minutes);

  update public.offers
     set status = 'payment_pending', accepted_at = now(), expires_at = v_due_at
   where id = p_offer_id;

  update public.projects
     set status = 'pending_payment', payment_status = 'pending',
         payment_due_at = v_due_at, selected_quote_id = null,
         selected_offer_id = p_offer_id, awarded_quote_id = null
   where id = v_project.id;

  return query select v_project.id, p_offer_id, v_due_at;
end $$;

-- 8) grandfather existing paid projects into the new lifecycle -------
update public.projects p
   set status = 'in_progress',
       contractor_fee_status = 'paid',
       contractor_fee_paid_at = coalesce(p.paid_at, now()),
       contractor_fee_amount = round(coalesce((
         select coalesce(pay.project_amount, pay.deposit_amount, pay.total_amount, 0)
         from public.payments pay where pay.project_id = p.id
         order by pay.created_at limit 1), 0) * 0.08, 2)
 where p.status = 'paid';
