-- =====================================================================
-- 007_project_status_contract_alignment.sql
-- =====================================================================
-- Align the project status enum and project table with the states used by
-- the quote/offer, checkout, and escrow UI flows.
--
-- Earlier app code and migrations reference these states:
--   quoted, negotiating, pending_payment, paid
-- and the escrow trigger references projects.completed_at.
-- Without these additions, accept/checkout/complete actions can fail at the
-- database layer even when the UI button itself fires correctly.
-- =====================================================================

alter type public.project_status add value if not exists 'quoted';
alter type public.project_status add value if not exists 'negotiating';
alter type public.project_status add value if not exists 'pending_payment';
alter type public.project_status add value if not exists 'paid';

alter table public.projects
  add column if not exists completed_at timestamptz;

