-- =====================================================================
-- 013_moderation_support_disputes.sql
-- =====================================================================
-- Adds the trust & moderation layer:
--   * projects.moderation_status/note/at/by  - admin approval gate; new
--     projects start 'pending' and are hidden from contractors until an
--     admin approves them. Existing projects backfilled to 'approved'.
--   * profiles.suspended/at/reason            - account suspension.
--   * contractor_profiles.verification_status - verification workflow.
--   * support_reports table                   - "report a problem".
--   * disputes table                          - dispute resolution.
--   * "projects contractor browse" RLS now also requires
--     moderation_status='approved'.
-- See the applied Supabase migration "moderation_support_disputes" for the
-- exact statements (idempotent).
-- =====================================================================

alter table public.projects
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists moderation_note   text,
  add column if not exists moderated_at      timestamptz,
  add column if not exists moderated_by      uuid references public.profiles(id) on delete set null;
update public.projects set moderation_status = 'approved' where moderation_status = 'pending';

alter table public.profiles
  add column if not exists suspended         boolean not null default false,
  add column if not exists suspended_at      timestamptz,
  add column if not exists suspension_reason text;

alter table public.contractor_profiles
  add column if not exists verification_status text not null default 'unverified';
update public.contractor_profiles set verification_status = 'verified'
  where verified = true and verification_status <> 'verified';

create table if not exists public.support_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_role text,
  project_id uuid references public.projects(id) on delete set null,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.support_reports enable row level security;
create policy "support self insert" on public.support_reports
  for insert with check (auth.uid() = reporter_id);
create policy "support self read" on public.support_reports
  for select using (auth.uid() = reporter_id);

create table if not exists public.disputes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  raised_by uuid not null references public.profiles(id) on delete cascade,
  raised_by_role text,
  reason text not null,
  status text not null default 'open',
  resolution text,
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.disputes enable row level security;
create policy "disputes participant read" on public.disputes
  for select using (
    raised_by = auth.uid()
    or exists (select 1 from public.projects p where p.id = disputes.project_id and p.homeowner_id = auth.uid())
    or exists (select 1 from public.payments pay where pay.project_id = disputes.project_id and pay.payee_id = auth.uid())
  );
create policy "disputes participant insert" on public.disputes
  for insert with check (
    raised_by = auth.uid()
    and (
      exists (select 1 from public.projects p where p.id = project_id and p.homeowner_id = auth.uid())
      or exists (select 1 from public.payments pay where pay.project_id = project_id and pay.payee_id = auth.uid())
    )
  );
