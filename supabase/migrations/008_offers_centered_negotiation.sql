-- 003_offers_centered_negotiation.sql
-- Move marketplace negotiation toward an offers-centered model.
-- This migration only adds columns/indexes. It does not drop legacy quote columns/tables.

alter table projects
add column if not exists selected_offer_id uuid;

alter table projects
add column if not exists awarded_offer_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'projects_selected_offer_id_fkey'
  ) then
    alter table projects
    add constraint projects_selected_offer_id_fkey
    foreign key (selected_offer_id)
    references offers(id)
    on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'projects_awarded_offer_id_fkey'
  ) then
    alter table projects
    add constraint projects_awarded_offer_id_fkey
    foreign key (awarded_offer_id)
    references offers(id)
    on delete set null;
  end if;
end $$;

alter table offers
add column if not exists recipient_id uuid;

alter table offers
add column if not exists recipient_role text;

alter table offers
add column if not exists included_items text[];

alter table offers
add column if not exists excluded_items text[];

alter table offers
add column if not exists notes text;

alter table offers
add column if not exists contractor_fee_percent numeric;

alter table offers
add column if not exists contractor_fee_amount numeric;

alter table offers
add column if not exists contractor_fee_status text;

alter table offers
add column if not exists contractor_fee_authorized boolean default false;

alter table offers
add column if not exists contractor_fee_authorized_at timestamptz;

alter table offers
add column if not exists accepted_at timestamptz;

alter table offers
add column if not exists rejected_at timestamptz;

alter table offers
add column if not exists expired_at timestamptz;

alter table offers
add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'offers_recipient_id_fkey'
  ) then
    alter table offers
    add constraint offers_recipient_id_fkey
    foreign key (recipient_id)
    references profiles(id)
    on delete set null;
  end if;
end $$;

alter table messages
add column if not exists offer_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'messages_offer_id_fkey'
  ) then
    alter table messages
    add constraint messages_offer_id_fkey
    foreign key (offer_id)
    references offers(id)
    on delete set null;
  end if;
end $$;

create index if not exists idx_projects_selected_offer_id
on projects(selected_offer_id);

create index if not exists idx_projects_awarded_offer_id
on projects(awarded_offer_id);

create index if not exists idx_offers_project_id
on offers(project_id);

create index if not exists idx_offers_conversation_id
on offers(conversation_id);

create index if not exists idx_offers_parent_offer_id
on offers(parent_offer_id);

create index if not exists idx_offers_sender_id
on offers(sender_id);

create index if not exists idx_offers_recipient_id
on offers(recipient_id);

create index if not exists idx_offers_project_status_created
on offers(project_id, status, created_at desc);

create index if not exists idx_offers_conversation_status_created
on offers(conversation_id, status, created_at desc);

create index if not exists idx_messages_offer_id
on messages(offer_id);