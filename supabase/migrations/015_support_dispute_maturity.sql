-- =====================================================================
-- 015_support_dispute_maturity.sql
-- Makes support/dispute cases operationally useful without changing the
-- existing basic tables.
-- =====================================================================

alter table public.support_reports
  add column if not exists priority text not null default 'normal',
  add column if not exists requested_outcome text,
  add column if not exists contact_preference text,
  add column if not exists page_url text,
  add column if not exists assigned_admin_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_user_message_at timestamptz,
  add column if not exists last_admin_response_at timestamptz;

alter table public.disputes
  add column if not exists category text not null default 'work_quality',
  add column if not exists priority text not null default 'high',
  add column if not exists requested_resolution text,
  add column if not exists evidence_summary text,
  add column if not exists assigned_admin_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_user_message_at timestamptz,
  add column if not exists last_admin_response_at timestamptz;

create index if not exists idx_support_reports_status_priority
  on public.support_reports(status, priority, created_at desc);

create index if not exists idx_disputes_status_priority
  on public.disputes(status, priority, created_at desc);

comment on column public.support_reports.priority is
  'low | normal | high | urgent. Used by admin triage.';
comment on column public.support_reports.requested_outcome is
  'What the user wants bidAI support to do.';
comment on column public.disputes.requested_resolution is
  'release_to_contractor | refund_homeowner | partial_refund | continue_job | other.';
comment on column public.disputes.evidence_summary is
  'Structured free-text evidence/context supplied when dispute is opened.';
