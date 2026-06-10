-- =====================================================================
-- 002_project_detail_questions.sql
-- Adds the detail-question fields collected when a homeowner posts a
-- project: quality level, project scope, material preferences, and a
-- finer-grained street address.
--
-- All operations are idempotent (safe to re-run).
-- =====================================================================

-- Enums --------------------------------------------------------------
do $$ begin
  create type quality_level as enum ('budget', 'standard', 'premium');
exception when duplicate_object then null; end $$;

do $$ begin
  -- "scope" describes the kind of work, independent of the category:
  --  full_remodel    — gut and rebuild everything in the area
  --  partial_remodel — keep some elements, replace others
  --  repair          — fix what's broken, no scope expansion
  --  new_install     — net-new build (e.g., add a deck where none existed)
  create type project_scope as enum ('full_remodel', 'partial_remodel', 'repair', 'new_install');
exception when duplicate_object then null; end $$;

-- Columns on projects ------------------------------------------------
alter table public.projects
  add column if not exists quality_level quality_level,
  add column if not exists project_scope project_scope,
  add column if not exists material_preferences text,
  add column if not exists street_address text;

-- Helpful comment so the dashboard SQL editor shows context
comment on column public.projects.quality_level is
  'budget = entry-level fixtures, standard = mid-range, premium = high-end finishes';
comment on column public.projects.project_scope is
  'full_remodel | partial_remodel | repair | new_install';
comment on column public.projects.material_preferences is
  'Free-form notes from the homeowner about specific materials/brands they want';
comment on column public.projects.street_address is
  'Optional. Stored privately and only revealed to the awarded contractor';
