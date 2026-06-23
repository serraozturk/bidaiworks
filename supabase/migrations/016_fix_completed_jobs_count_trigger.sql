-- =====================================================================
-- 016_fix_completed_jobs_count_trigger.sql
-- =====================================================================
-- Bug: bump_contractor_completed_jobs only matched sender_role='contractor'
-- on the awarded offer. If the winning deal was a homeowner counter-offer
-- (sender_role='homeowner'), cid stayed null and completed_jobs_count was
-- never incremented.
--
-- Fix: derive contractor_id from the offer using the same CASE logic that
-- homeowner_pay_project and contractor_pay_commitment already use:
--   sender_role='contractor'  → sender_id  is the contractor
--   sender_role='homeowner'   → recipient_id is the contractor
-- =====================================================================

create or replace function public.bump_contractor_completed_jobs()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  cid uuid;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then

    select coalesce(
      -- 1. quotes path (legacy)
      (select q.contractor_id
         from public.quotes q
        where q.id = new.awarded_quote_id),

      -- 2. awarded_offer path — works regardless of who sent the offer
      (select case
                when o.sender_role = 'contractor' then o.sender_id
                else o.recipient_id
              end
         from public.offers o
        where o.id = new.awarded_offer_id),

      -- 3. fallback: most-recently accepted offer on this project
      (select case
                when o.sender_role = 'contractor' then o.sender_id
                else o.recipient_id
              end
         from public.offers o
        where o.project_id = new.id
          and o.status = 'accepted'
        order by coalesce(o.responded_at, o.updated_at) desc
        limit 1)
    ) into cid;

    if cid is not null then
      update public.contractor_profiles
         set completed_jobs_count = completed_jobs_count + 1
       where user_id = cid;
    end if;
  end if;
  return new;
end $$;

-- Re-attach trigger (idempotent).
drop trigger if exists trg_projects_completed_jobs on public.projects;
create trigger trg_projects_completed_jobs
  after update of status on public.projects
  for each row execute function public.bump_contractor_completed_jobs();

revoke execute on function public.bump_contractor_completed_jobs() from anon, authenticated, public;
alter function public.bump_contractor_completed_jobs() set search_path = public, pg_catalog;
