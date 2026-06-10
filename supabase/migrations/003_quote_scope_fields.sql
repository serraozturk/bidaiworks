-- Structured contractor offer fields.
alter table public.quotes
  add column if not exists included_scope text,
  add column if not exists excluded_scope text,
  add column if not exists notes text;

