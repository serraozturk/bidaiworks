-- =====================================================================
-- bidAI initial schema
-- =====================================================================
-- Run this file in your Supabase SQL editor (Database > SQL Editor)
-- or via `supabase db push` if you use the CLI.
--
-- Order matters: extensions, enums, tables, indexes, RLS policies,
-- triggers, then seed-able reference data is in seed.sql.
-- =====================================================================

-- Extensions ----------------------------------------------------------
create extension if not exists "uuid-ossp";

-- Enums ---------------------------------------------------------------
do $$ begin
  create type user_role as enum ('homeowner', 'contractor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum (
    'draft',          -- being created by the homeowner
    'open',           -- accepting quotes from contractors
    'in_review',      -- homeowner reviewing quotes
    'awarded',        -- a quote has been accepted
    'in_progress',    -- contractor doing the work
    'completed',      -- work finished, can be reviewed
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_status as enum (
    'pending', 'accepted', 'rejected', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

-- =====================================================================
-- profiles: one row per auth.users entry
-- Created by trigger handle_new_user (defined at the bottom).
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'homeowner',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- categories: renovation types (seeded in seed.sql)
-- =====================================================================
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,            -- lucide icon name, used in UI
  sort_order int not null default 0
);

-- =====================================================================
-- contractor_profiles: extends profiles for users with role='contractor'
-- =====================================================================
create table if not exists public.contractor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null,
  license_number text,
  bio text,
  years_in_business int,
  website text,
  logo_url text,
  verified boolean not null default false,
  -- aggregated rating fields, kept up to date by a trigger on reviews
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- many-to-many: a contractor can serve many categories
create table if not exists public.contractor_categories (
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (contractor_id, category_id)
);

-- service-area ZIPs the contractor will travel to
create table if not exists public.contractor_service_areas (
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  primary key (contractor_id, zip_code)
);
create index if not exists idx_contractor_service_areas_zip
  on public.contractor_service_areas(zip_code);

-- =====================================================================
-- projects: a homeowner's renovation request
-- =====================================================================
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  title text not null,
  description text not null,
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  city text,
  state text,
  square_footage int,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  desired_start_date date,
  -- AI-generated estimate stored alongside the project. Populated by
  -- /api/ai-estimate when the project is created.
  ai_estimate_min numeric(10,2),
  ai_estimate_max numeric(10,2),
  ai_estimate_reasoning text,
  status project_status not null default 'open',
  awarded_quote_id uuid,    -- set when a quote is accepted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_projects_status_zip on public.projects(status, zip_code);
create index if not exists idx_projects_category on public.projects(category_id);
create index if not exists idx_projects_homeowner on public.projects(homeowner_id);

create table if not exists public.project_photos (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  caption text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_project_photos_project on public.project_photos(project_id);

-- =====================================================================
-- quotes: a contractor's offer on a project
-- =====================================================================
create table if not exists public.quotes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  timeline_days int check (timeline_days > 0),
  message text,
  status quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, contractor_id)  -- one quote per contractor per project
);
create index if not exists idx_quotes_project on public.quotes(project_id);
create index if not exists idx_quotes_contractor on public.quotes(contractor_id);

alter table public.projects
  add constraint projects_awarded_quote_fk
  foreign key (awarded_quote_id) references public.quotes(id) on delete set null
  deferrable initially deferred;

-- =====================================================================
-- conversations + messages: scoped per (project, homeowner, contractor)
-- =====================================================================
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, contractor_id)
);
create index if not exists idx_conversations_homeowner on public.conversations(homeowner_id);
create index if not exists idx_conversations_contractor on public.conversations(contractor_id);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);

-- =====================================================================
-- reviews: homeowner reviews a contractor after project completion
-- =====================================================================
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (project_id, reviewer_id)
);
create index if not exists idx_reviews_contractor on public.reviews(contractor_id);

-- =====================================================================
-- Triggers
-- =====================================================================

-- 1) Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contractor_profiles_updated on public.contractor_profiles;
create trigger trg_contractor_profiles_updated before update on public.contractor_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_quotes_updated on public.quotes;
create trigger trg_quotes_updated before update on public.quotes
  for each row execute function public.set_updated_at();

-- 2) Auto-create a profile row when a new auth.users row appears.
--    The signup form passes role/full_name in raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'homeowner'),
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Recalculate contractor rating after a review is inserted/updated/deleted
create or replace function public.recalc_contractor_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid uuid := coalesce(new.contractor_id, old.contractor_id);
begin
  update public.contractor_profiles cp
  set rating_avg = coalesce((select avg(rating)::numeric(3,2) from public.reviews where contractor_id = cid), 0),
      rating_count = (select count(*) from public.reviews where contractor_id = cid)
  where cp.user_id = cid;
  return null;
end $$;

drop trigger if exists trg_reviews_recalc on public.reviews;
create trigger trg_reviews_recalc
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_contractor_rating();

-- 4) Bump conversation.last_message_at on new message
create or replace function public.bump_conversation_last_message()
returns trigger language plpgsql as $$
begin
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_messages_bump_conv on public.messages;
create trigger trg_messages_bump_conv
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- Strategy:
--  * profiles: any authenticated user can read; only owner can update.
--  * categories: public read.
--  * contractor_profiles + contractor_categories + service_areas:
--      public read (so homeowners can browse contractors); contractor owns row writes.
--  * projects: homeowner reads own; contractors read open projects in their service area.
--  * quotes: homeowner reads quotes on their projects; contractor reads own quotes.
--  * conversations + messages: only the two participants.
--  * reviews: public read; only the homeowner who owns the project can write.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.contractor_profiles enable row level security;
alter table public.contractor_categories enable row level security;
alter table public.contractor_service_areas enable row level security;
alter table public.projects enable row level security;
alter table public.project_photos enable row level security;
alter table public.quotes enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

-- profiles ------------------------------------------------------------
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read"   on public.profiles
  for select using (true);
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- categories ----------------------------------------------------------
drop policy if exists "categories read" on public.categories;
create policy "categories read" on public.categories
  for select using (true);

-- contractor_profiles -------------------------------------------------
drop policy if exists "contractor_profiles read" on public.contractor_profiles;
create policy "contractor_profiles read" on public.contractor_profiles
  for select using (true);
drop policy if exists "contractor_profiles upsert self" on public.contractor_profiles;
create policy "contractor_profiles upsert self" on public.contractor_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "contractor_categories read" on public.contractor_categories;
create policy "contractor_categories read" on public.contractor_categories
  for select using (true);
drop policy if exists "contractor_categories write self" on public.contractor_categories;
create policy "contractor_categories write self" on public.contractor_categories
  for all using (auth.uid() = contractor_id) with check (auth.uid() = contractor_id);

drop policy if exists "contractor_service_areas read" on public.contractor_service_areas;
create policy "contractor_service_areas read" on public.contractor_service_areas
  for select using (true);
drop policy if exists "contractor_service_areas write self" on public.contractor_service_areas;
create policy "contractor_service_areas write self" on public.contractor_service_areas
  for all using (auth.uid() = contractor_id) with check (auth.uid() = contractor_id);

-- projects ------------------------------------------------------------
-- homeowner can do everything with their own projects
drop policy if exists "projects homeowner full" on public.projects;
create policy "projects homeowner full" on public.projects
  for all using (auth.uid() = homeowner_id) with check (auth.uid() = homeowner_id);

-- contractors can read open/in_review projects in their service area
-- AND in a category they serve. This is the matching rule of the marketplace.
drop policy if exists "projects contractor browse" on public.projects;
create policy "projects contractor browse" on public.projects
  for select using (
    status in ('open', 'in_review')
    and exists (
      select 1
      from public.contractor_service_areas csa
      join public.contractor_categories cc on cc.contractor_id = csa.contractor_id
      where csa.contractor_id = auth.uid()
        and csa.zip_code = projects.zip_code
        and cc.category_id = projects.category_id
    )
  );

-- A contractor who has submitted a quote can keep reading the project
-- even if their service-area definition later changes.
drop policy if exists "projects contractor quoted" on public.projects;
create policy "projects contractor quoted" on public.projects
  for select using (
    exists (select 1 from public.quotes q
            where q.project_id = projects.id and q.contractor_id = auth.uid())
  );

-- project_photos ------------------------------------------------------
drop policy if exists "project_photos read" on public.project_photos;
create policy "project_photos read" on public.project_photos
  for select using (
    -- if you can read the parent project, you can read its photos
    exists (select 1 from public.projects p where p.id = project_photos.project_id)
  );
drop policy if exists "project_photos write owner" on public.project_photos;
create policy "project_photos write owner" on public.project_photos
  for all using (
    exists (select 1 from public.projects p
            where p.id = project_photos.project_id and p.homeowner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p
            where p.id = project_photos.project_id and p.homeowner_id = auth.uid())
  );

-- quotes --------------------------------------------------------------
drop policy if exists "quotes contractor own" on public.quotes;
create policy "quotes contractor own" on public.quotes
  for all using (auth.uid() = contractor_id) with check (auth.uid() = contractor_id);

drop policy if exists "quotes homeowner read" on public.quotes;
create policy "quotes homeowner read" on public.quotes
  for select using (
    exists (select 1 from public.projects p
            where p.id = quotes.project_id and p.homeowner_id = auth.uid())
  );

-- homeowner can update quote status (accept/reject) on their own projects
drop policy if exists "quotes homeowner status" on public.quotes;
create policy "quotes homeowner status" on public.quotes
  for update using (
    exists (select 1 from public.projects p
            where p.id = quotes.project_id and p.homeowner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p
            where p.id = quotes.project_id and p.homeowner_id = auth.uid())
  );

-- conversations -------------------------------------------------------
drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations
  for all using (auth.uid() in (homeowner_id, contractor_id))
         with check (auth.uid() in (homeowner_id, contractor_id));

-- messages ------------------------------------------------------------
drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages
  for select using (
    exists (select 1 from public.conversations c
            where c.id = messages.conversation_id
              and auth.uid() in (c.homeowner_id, c.contractor_id))
  );
drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from public.conversations c
                where c.id = messages.conversation_id
                  and auth.uid() in (c.homeowner_id, c.contractor_id))
  );

-- reviews -------------------------------------------------------------
drop policy if exists "reviews read" on public.reviews;
create policy "reviews read" on public.reviews for select using (true);

drop policy if exists "reviews homeowner write" on public.reviews;
create policy "reviews homeowner write" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    and exists (select 1 from public.projects p
                where p.id = reviews.project_id
                  and p.homeowner_id = auth.uid()
                  and p.status = 'completed')
  );

drop policy if exists "reviews homeowner update" on public.reviews;
create policy "reviews homeowner update" on public.reviews
  for update using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);

-- =====================================================================
-- Storage: a `project-photos` bucket should be created in the Supabase
-- dashboard (Storage > New bucket > public). RLS on storage.objects
-- can be added later; for the MVP photos are public-readable.
-- =====================================================================
