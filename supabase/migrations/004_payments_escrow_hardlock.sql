-- =====================================================================
-- 004_payments_escrow_hardlock.sql
-- bidAI: simulated payments + escrow + withdrawals + hard-lock chat
-- =====================================================================
-- Adds:
--   * payments         — one row per homeowner deposit (held/released/refunded)
--   * withdrawals      — one row per contractor cash-out (pending/completed/failed)
--   * v_contractor_balances — convenience view summing held / released / withdrawn
--   * release_escrow_on_completion trigger on projects.status -> 'completed'
--   * accept_quote(quote_id)  — RPC: hard-lock award via formal quote
--   * accept_offer(offer_id)  — RPC: hard-lock award via in-chat offer
--   * messages INSERT policy update — once a project is past negotiation
--     (awarded/pending_payment/paid/in_progress/completed/cancelled),
--     only kind='system' messages can be written
--
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type payment_status as enum ('held', 'released', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type withdrawal_status as enum ('pending', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('card', 'bank', 'wire');
exception when duplicate_object then null; end $$;

alter type public.project_status add value if not exists 'quoted';
alter type public.project_status add value if not exists 'negotiating';
alter type public.project_status add value if not exists 'pending_payment';
alter type public.project_status add value if not exists 'paid';

alter table public.projects
  add column if not exists completed_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. payments
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  payer_id uuid not null references public.profiles(id) on delete cascade,    -- homeowner
  payee_id uuid not null references public.profiles(id) on delete cascade,    -- contractor
  total_amount numeric(10,2) not null check (total_amount > 0),
  deposit_amount numeric(10,2) not null check (deposit_amount > 0),
  deposit_pct int not null check (deposit_pct between 1 and 100),
  method payment_method not null default 'card',
  card_last4 text,
  status payment_status not null default 'held',
  held_at timestamptz not null default now(),
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_project on public.payments(project_id);
create index if not exists idx_payments_payer on public.payments(payer_id);
create index if not exists idx_payments_payee on public.payments(payee_id);
create index if not exists idx_payments_status on public.payments(status);

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

drop policy if exists "payments participants read" on public.payments;
create policy "payments participants read" on public.payments
  for select using (auth.uid() = payer_id or auth.uid() = payee_id);

drop policy if exists "payments payer insert" on public.payments;
create policy "payments payer insert" on public.payments
  for insert with check (
    auth.uid() = payer_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.homeowner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 3. withdrawals
-- ---------------------------------------------------------------------
create table if not exists public.withdrawals (
  id uuid primary key default uuid_generate_v4(),
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status withdrawal_status not null default 'pending',
  bank_name text,
  routing_last4 text,
  account_last4 text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_withdrawals_contractor on public.withdrawals(contractor_id);
create index if not exists idx_withdrawals_status on public.withdrawals(status);

drop trigger if exists trg_withdrawals_updated on public.withdrawals;
create trigger trg_withdrawals_updated before update on public.withdrawals
  for each row execute function public.set_updated_at();

alter table public.withdrawals enable row level security;

drop policy if exists "withdrawals self read" on public.withdrawals;
create policy "withdrawals self read" on public.withdrawals
  for select using (auth.uid() = contractor_id);

drop policy if exists "withdrawals self insert" on public.withdrawals;
create policy "withdrawals self insert" on public.withdrawals
  for insert with check (auth.uid() = contractor_id);

-- ---------------------------------------------------------------------
-- 4. release escrow when a project is marked completed
-- ---------------------------------------------------------------------
create or replace function public.release_escrow_on_completion()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update public.payments
       set status = 'released', released_at = now()
     where project_id = new.id and status = 'held';
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.release_escrow_on_completion() from anon, authenticated, public;

drop trigger if exists trg_release_escrow on public.projects;
create trigger trg_release_escrow
  before update of status on public.projects
  for each row execute function public.release_escrow_on_completion();

-- ---------------------------------------------------------------------
-- 5. accept_quote RPC (hard-lock via formal quote)
-- ---------------------------------------------------------------------
create or replace function public.accept_quote(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_project_id uuid;
  v_homeowner uuid;
  v_contractor uuid;
  v_status text;
begin
  select q.project_id, p.homeowner_id, q.contractor_id, p.status::text
    into v_project_id, v_homeowner, v_contractor, v_status
    from public.quotes q
    join public.projects p on p.id = q.project_id
   where q.id = p_quote_id;

  if v_project_id is null then
    raise exception 'quote not found';
  end if;
  if v_homeowner is distinct from auth.uid() then
    raise exception 'only the homeowner can accept a quote';
  end if;
  if v_status not in ('open', 'in_review', 'quoted', 'negotiating') then
    raise exception 'project is no longer accepting acceptances (status=%)', v_status;
  end if;

  update public.quotes set status = 'accepted' where id = p_quote_id and status = 'pending';
  update public.quotes set status = 'rejected'
    where project_id = v_project_id and id <> p_quote_id and status = 'pending';
  update public.offers set status = 'rejected', responded_at = now()
    where project_id = v_project_id and status = 'pending';

  update public.projects
     set status = 'awarded', awarded_quote_id = p_quote_id
   where id = v_project_id;
end $$;

revoke execute on function public.accept_quote(uuid) from public;
grant execute on function public.accept_quote(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. accept_offer RPC (hard-lock via in-chat offer)
-- ---------------------------------------------------------------------
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_offer record;
  v_project record;
  v_contractor uuid;
  v_homeowner uuid;
  v_quote_id uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id;
  if not found then raise exception 'offer not found'; end if;

  select id, homeowner_id, status::text into v_project
    from public.projects where id = v_offer.project_id;
  if v_project.id is null then raise exception 'project not found'; end if;

  -- Determine homeowner / contractor from the offer pair
  if v_offer.sender_role = 'homeowner' then
    v_homeowner := v_offer.sender_id;
    select contractor_id into v_contractor from public.conversations
     where id = v_offer.conversation_id;
  else
    v_contractor := v_offer.sender_id;
    v_homeowner := v_project.homeowner_id;
  end if;

  if auth.uid() not in (v_homeowner, v_contractor) then
    raise exception 'only conversation participants can accept';
  end if;
  if auth.uid() = v_offer.sender_id then
    raise exception 'cannot accept your own offer';
  end if;
  if v_project.status not in ('open', 'in_review', 'quoted', 'negotiating') then
    raise exception 'project is no longer accepting acceptances (status=%)', v_project.status;
  end if;

  -- Mark this offer accepted, all other pending offers rejected
  update public.offers set status = 'accepted', responded_at = now() where id = p_offer_id;
  update public.offers set status = 'rejected', responded_at = now()
    where project_id = v_offer.project_id and id <> p_offer_id and status = 'pending';

  -- Synthesize a quote so checkout works uniformly
  select id into v_quote_id from public.quotes
    where project_id = v_offer.project_id and contractor_id = v_contractor
    limit 1;

  if v_quote_id is not null then
    update public.quotes
       set amount = v_offer.amount,
           timeline_days = v_offer.timeline_days,
           message = coalesce(v_offer.scope_summary, v_offer.message),
           status = 'accepted'
     where id = v_quote_id;
  else
    insert into public.quotes (project_id, contractor_id, amount, timeline_days, message, status)
    values (v_offer.project_id, v_contractor, v_offer.amount, v_offer.timeline_days,
            coalesce(v_offer.scope_summary, v_offer.message), 'accepted')
    returning id into v_quote_id;
  end if;

  -- Reject any other pending quotes
  update public.quotes set status = 'rejected'
    where project_id = v_offer.project_id and id <> v_quote_id and status = 'pending';

  -- Award the project
  update public.projects
     set status = 'awarded',
         awarded_quote_id = v_quote_id,
         awarded_offer_id = p_offer_id
   where id = v_offer.project_id;

  return v_quote_id;
end $$;

revoke execute on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Hard-lock chat: only system messages allowed once awarded
-- ---------------------------------------------------------------------
drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.homeowner_id or auth.uid() = c.contractor_id)
    )
    and (
      -- system messages are always allowed (status changes, deposit confirms, etc.)
      messages.kind = 'system'
      -- otherwise the project must still be in negotiation
      or exists (
        select 1
        from public.conversations c
        join public.projects p on p.id = c.project_id
        where c.id = messages.conversation_id
          and p.status::text in ('open', 'in_review', 'quoted', 'negotiating')
      )
    )
  );

-- ---------------------------------------------------------------------
-- 8. Hard-lock offers: cannot insert new offers once awarded
-- ---------------------------------------------------------------------
drop policy if exists "offers send" on public.offers;
create policy "offers send" on public.offers
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = sender_role
    )
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.status::text in ('open', 'in_review', 'quoted', 'negotiating')
    )
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and auth.uid() in (c.homeowner_id, c.contractor_id)
      )
    )
  );
