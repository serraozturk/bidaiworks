-- =====================================================================
-- 014_category_brief_admin.sql
-- Admin-managed category brief configuration.
-- Lets admins manage customer intake questions, required photo angles and
-- material fields without editing frontend code.
-- =====================================================================

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null,
  add column if not exists active boolean not null default true,
  add column if not exists commission_rate numeric(5,2);

create index if not exists idx_categories_parent on public.categories(parent_id);
create index if not exists idx_categories_active_sort on public.categories(active, sort_order);

create table if not exists public.category_brief_questions (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete cascade,
  question_key text not null,
  label text not null,
  type text not null check (type in ('text', 'textarea', 'single_select', 'multi_select', 'number', 'yes_no')),
  required boolean not null default true,
  options jsonb not null default '[]'::jsonb,
  help_text text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, question_key)
);

create table if not exists public.category_photo_requirements (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete cascade,
  photo_key text not null,
  label text not null,
  description text,
  required boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, photo_key)
);

create table if not exists public.category_material_fields (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete cascade,
  item_key text not null,
  label text not null,
  options jsonb not null default '[]'::jsonb,
  quality_levels jsonb not null default '["Budget","Standard","Premium","Luxury"]'::jsonb,
  allow_custom boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, item_key)
);

drop trigger if exists trg_category_brief_questions_updated on public.category_brief_questions;
create trigger trg_category_brief_questions_updated before update on public.category_brief_questions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_category_photo_requirements_updated on public.category_photo_requirements;
create trigger trg_category_photo_requirements_updated before update on public.category_photo_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_category_material_fields_updated on public.category_material_fields;
create trigger trg_category_material_fields_updated before update on public.category_material_fields
  for each row execute function public.set_updated_at();

alter table public.category_brief_questions enable row level security;
alter table public.category_photo_requirements enable row level security;
alter table public.category_material_fields enable row level security;

drop policy if exists "category_brief_questions read active" on public.category_brief_questions;
create policy "category_brief_questions read active" on public.category_brief_questions
  for select using (is_active = true);

drop policy if exists "category_photo_requirements read active" on public.category_photo_requirements;
create policy "category_photo_requirements read active" on public.category_photo_requirements
  for select using (is_active = true);

drop policy if exists "category_material_fields read active" on public.category_material_fields;
create policy "category_material_fields read active" on public.category_material_fields
  for select using (is_active = true);

comment on table public.category_brief_questions is
  'Admin-managed dynamic project intake questions per category.';
comment on table public.category_photo_requirements is
  'Admin-managed required photo angles per category.';
comment on table public.category_material_fields is
  'Admin-managed material preference fields per category.';
