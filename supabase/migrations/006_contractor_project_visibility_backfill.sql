-- =====================================================================
-- 006_contractor_project_visibility_backfill.sql
-- =====================================================================
-- Fixes:
--  (1) Contractors couldn't read awarded/in_progress/completed projects
--      because the only contractor select policy required status in
--      ('open','in_review'). That broke "view project" links, jobs page,
--      earnings page joins, and messages filters once a project was
--      awarded.
--  (2) Pre-migration-004 awarded projects had no payments row, so the
--      earnings page (which now reads from payments) showed $0.
-- =====================================================================

-- (1) New select policy: contractors can read any project they
--     participate in (quote, offer, or conversation).
drop policy if exists "projects contractor participating" on public.projects;
create policy "projects contractor participating" on public.projects
  for select using (
    exists (
      select 1 from public.quotes q
      where q.project_id = projects.id and q.contractor_id = auth.uid()
    )
    or exists (
      select 1 from public.conversations c
      where c.project_id = projects.id and c.contractor_id = auth.uid()
    )
    or exists (
      select 1 from public.offers o
      where o.project_id = projects.id and o.sender_id = auth.uid()
    )
  );

-- (2) Backfill payments for already-awarded projects.
insert into public.payments (
  project_id, quote_id, payer_id, payee_id,
  total_amount, deposit_amount, deposit_pct, method, status,
  held_at, released_at, created_at, updated_at
)
select
  p.id,
  q.id,
  p.homeowner_id,
  q.contractor_id,
  q.amount,
  q.amount,
  100,
  'card'::payment_method,
  case when p.status = 'completed'
       then 'released'::payment_status
       else 'held'::payment_status end,
  coalesce(p.updated_at, p.created_at, now()),
  case when p.status = 'completed'
       then coalesce(p.completed_at, p.updated_at, now())
       else null end,
  coalesce(p.updated_at, p.created_at, now()),
  coalesce(p.updated_at, p.created_at, now())
from public.projects p
join public.quotes q on q.id = p.awarded_quote_id
where p.status in ('awarded','pending_payment','paid','in_progress','completed')
  and p.awarded_quote_id is not null
  and not exists (select 1 from public.payments py where py.project_id = p.id);
