-- =====================================================================
-- 003_offers_reviews_profiles.sql
-- bidAI: full-spec schema upgrade
-- =====================================================================
-- This migration brings the schema up to the full product spec:
--
--   * Two-way OFFERS system (homeowner budget offers, contractor quick
--     offers, counter offers) with parent-offer chain. `quotes` stays
--     for formal binding contractor quotes.
--   * Multi-dimensional platform reviews (overall, work quality,
--     communication, punctuality, value) + review photos.
--   * Google review fields on contractor_profiles (kept SEPARATE from
--     platform rating).
--   * Cover image, insurance/license status, completed_jobs_count,
--     response_time_hours, verified_at on contractor_profiles.
--   * City/state on contractor_service_areas (in addition to ZIP).
--   * Contractor portfolio photos.
--   * Saved-contractors bookmarks for homeowners.
--   * Conversation read-tracking per participant + message kind +
--     offer_id / quote_id on messages so the chat thread can render
--     offer cards / quote cards inline.
--   * projects.awarded_offer_id (counterpart to awarded_quote_id) so
--     a project can be awarded via either an accepted offer or a quote.
--   * Storage buckets for contractor portfolio, contractor cover, and
--     review photos.
--
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type offer_kind as enum (
    'budget_offer',     -- homeowner: "Can you do this scope for $X?"
    'counter_offer',    -- response with a different number/timeline
    'quick_offer'       -- contractor: ballpark before a formal quote
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type offer_status as enum (
    'pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_kind as enum (
    'text', 'offer_card', 'quote_card', 'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type insurance_status as enum (
    'none', 'submitted', 'verified', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type license_status as enum (
    'none', 'submitted', 'verified', 'expired'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. contractor_profiles enrichment
-- ---------------------------------------------------------------------
alter table public.contractor_profiles
  add column if not exists cover_image_url text,
  add column if not exists insurance_status insurance_status not null default 'none',
  add column if not exists insurance_carrier text,
  add column if not exists insurance_expires_at date,
  add column if not exists license_status license_status not null default 'none',
  add column if not exists license_expires_at date,
  add column if not exists completed_jobs_count int not null default 0,
  add column if not exists response_time_hours int,
  add column if not exists verified_at timestamptz,
  add column if not exists google_rating numeric(2,1) check (google_rating is null or (google_rating between 0 and 5)),
  add column if not exists google_review_count int check (google_review_count is null or google_review_count >= 0),
  add column if not exists google_profile_url text,
  add column if not exists google_place_id text,
  add column if not exists google_last_synced_at timestamptz;

comment on column public.contractor_profiles.cover_image_url is
  'Hero/cover image shown on the contractor profile page.';
comment on column public.contractor_profiles.completed_jobs_count is
  'Cached count of projects awarded to this contractor that reached status=completed. Bumped by trg_projects_completed_jobs.';
comment on column public.contractor_profiles.google_rating is
  'Most recently synced Google Maps rating (0.0-5.0). Displayed SEPARATELY from platform rating; never combined.';
comment on column public.contractor_profiles.google_review_count is
  'Most recently synced Google Maps review count.';
comment on column public.contractor_profiles.google_place_id is
  'Google Place ID used when re-syncing the rating/review count.';

-- ---------------------------------------------------------------------
-- 3. contractor_service_areas: add city + state (still ZIP-anchored)
-- ---------------------------------------------------------------------
alter table public.contractor_service_areas
  add column if not exists city text,
  add column if not exists state text check (state is null or state ~ '^[A-Z]{2}$');

create index if not exists idx_contractor_service_areas_state_city
  on public.contractor_service_areas(state, city);

-- Update the matching policy: a contractor sees a project when their
-- category matches AND (their service-area ZIP equals the project ZIP
-- OR their service-area city/state equals the project city/state).
drop policy if exists "projects contractor browse" on public.projects;
create policy "projects contractor browse" on public.projects
  for select using (
    status in ('open', 'in_review')
    and exists (
      select 1
      from public.contractor_service_areas csa
      join public.contractor_categories cc on cc.contractor_id = csa.contractor_id
      where csa.contractor_id = auth.uid()
        and cc.category_id = projects.category_id
        and (
          csa.zip_code = projects.zip_code
          or (
            csa.city is not null and projects.city is not null
            and lower(csa.city) = lower(projects.city)
            and csa.state is not null and projects.state is not null
            and upper(csa.state) = upper(projects.state)
          )
        )
    )
  );

-- ---------------------------------------------------------------------
-- 4. Contractor portfolio photos
-- ---------------------------------------------------------------------
create table if not exists public.contractor_portfolio_photos (
  id uuid primary key default uuid_generate_v4(),
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
  url text not null,
  caption text,
  category_id uuid references public.categories(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_portfolio_contractor on public.contractor_portfolio_photos(contractor_id);

alter table public.contractor_portfolio_photos enable row level security;

drop policy if exists "portfolio read" on public.contractor_portfolio_photos;
create policy "portfolio read" on public.contractor_portfolio_photos
  for select using (true);

drop policy if exists "portfolio write self" on public.contractor_portfolio_photos;
create policy "portfolio write self" on public.contractor_portfolio_photos
  for all using (auth.uid() = contractor_id) with check (auth.uid() = contractor_id);

-- ---------------------------------------------------------------------
-- 5. Saved contractors (homeowner bookmarks)
-- ---------------------------------------------------------------------
create table if not exists public.saved_contractors (
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  primary key (homeowner_id, contractor_id)
);
create index if not exists idx_saved_contractors_homeowner on public.saved_contractors(homeowner_id);

alter table public.saved_contractors enable row level security;

drop policy if exists "saved read self" on public.saved_contractors;
create policy "saved read self" on public.saved_contractors
  for select using (auth.uid() = homeowner_id);

drop policy if exists "saved write self" on public.saved_contractors;
create policy "saved write self" on public.saved_contractors
  for all using (auth.uid() = homeowner_id) with check (auth.uid() = homeowner_id);

-- ---------------------------------------------------------------------
-- 6. Multi-dimensional platform reviews + review photos
-- ---------------------------------------------------------------------
alter table public.reviews
  add column if not exists rating_overall      int check (rating_overall      between 1 and 5),
  add column if not exists rating_work_quality int check (rating_work_quality between 1 and 5),
  add column if not exists rating_communication int check (rating_communication between 1 and 5),
  add column if not exists rating_punctuality  int check (rating_punctuality  between 1 and 5),
  add column if not exists rating_value        int check (rating_value        between 1 and 5);

-- Backfill rating_overall from the legacy single-rating column. Reviews
-- table currently has 0 rows so this is a no-op today; safe for later.
update public.reviews set rating_overall = rating where rating_overall is null;

create table if not exists public.review_photos (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  url text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_review_photos_review on public.review_photos(review_id);

alter table public.review_photos enable row level security;

drop policy if exists "review_photos read" on public.review_photos;
create policy "review_photos read" on public.review_photos
  for select using (
    exists (select 1 from public.reviews r where r.id = review_photos.review_id)
  );

drop policy if exists "review_photos write reviewer" on public.review_photos;
create policy "review_photos write reviewer" on public.review_photos
  for all using (
    exists (select 1 from public.reviews r
            where r.id = review_photos.review_id and r.reviewer_id = auth.uid())
  ) with check (
    exists (select 1 from public.reviews r
            where r.id = review_photos.review_id and r.reviewer_id = auth.uid())
  );

-- Recalc trigger: prefer rating_overall, fall back to legacy rating column.
create or replace function public.recalc_contractor_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid uuid := coalesce(new.contractor_id, old.contractor_id);
begin
  update public.contractor_profiles cp
  set rating_avg = coalesce(
        (select avg(coalesce(rating_overall, rating))::numeric(3,2)
         from public.reviews where contractor_id = cid),
        0
      ),
      rating_count = (select count(*) from public.reviews where contractor_id = cid)
  where cp.user_id = cid;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 7. Conversations: per-participant read tracking
-- ---------------------------------------------------------------------
alter table public.conversations
  add column if not exists last_read_homeowner_at  timestamptz not null default now(),
  add column if not exists last_read_contractor_at timestamptz not null default now();

comment on column public.conversations.last_read_homeowner_at is
  'Bumped by the homeowner client when the thread is opened. Used to compute unread counts.';
comment on column public.conversations.last_read_contractor_at is
  'Bumped by the contractor client when the thread is opened.';

-- ---------------------------------------------------------------------
-- 8. Offers: two-way negotiation table
-- ---------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  parent_offer_id uuid references public.offers(id) on delete set null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role user_role not null,
  kind offer_kind not null,
  amount numeric(10,2) not null check (amount > 0),
  timeline_days int check (timeline_days > 0),
  scope_summary text,
  message text,
  status offer_status not null default 'pending',
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_offers_project       on public.offers(project_id);
create index if not exists idx_offers_conversation  on public.offers(conversation_id);
create index if not exists idx_offers_sender        on public.offers(sender_id);
create index if not exists idx_offers_parent        on public.offers(parent_offer_id);
create index if not exists idx_offers_status        on public.offers(status);

drop trigger if exists trg_offers_updated on public.offers;
create trigger trg_offers_updated before update on public.offers
  for each row execute function public.set_updated_at();

alter table public.offers enable row level security;

-- READ: visible to the sender, the homeowner who owns the project, or
-- either participant of the linked conversation.
drop policy if exists "offers participants read" on public.offers;
create policy "offers participants read" on public.offers
  for select using (
    auth.uid() = sender_id
    or exists (select 1 from public.projects p
               where p.id = offers.project_id and p.homeowner_id = auth.uid())
    or exists (select 1 from public.conversations c
               where c.id = offers.conversation_id
                 and auth.uid() in (c.homeowner_id, c.contractor_id))
  );

-- INSERT: only the sender can create their own offer; if a conversation
-- is linked, they must be a participant; sender_role must match the
-- user's actual role in profiles.
drop policy if exists "offers send" on public.offers;
create policy "offers send" on public.offers
  for insert with check (
    auth.uid() = sender_id
    and (
      conversation_id is null
      or exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and auth.uid() in (c.homeowner_id, c.contractor_id))
    )
    and exists (select 1 from public.profiles pr
                where pr.id = auth.uid() and pr.role = sender_role)
  );

-- UPDATE: any participant can update (accept/reject/withdraw/counter).
drop policy if exists "offers update participants" on public.offers;
create policy "offers update participants" on public.offers
  for update using (
    auth.uid() = sender_id
    or exists (select 1 from public.projects p
               where p.id = offers.project_id and p.homeowner_id = auth.uid())
    or exists (select 1 from public.conversations c
               where c.id = offers.conversation_id
                 and auth.uid() in (c.homeowner_id, c.contractor_id))
  ) with check (
    auth.uid() = sender_id
    or exists (select 1 from public.projects p
               where p.id = offers.project_id and p.homeowner_id = auth.uid())
    or exists (select 1 from public.conversations c
               where c.id = offers.conversation_id
                 and auth.uid() in (c.homeowner_id, c.contractor_id))
  );

-- ---------------------------------------------------------------------
-- 9. projects.awarded_offer_id (parallel to awarded_quote_id)
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists awarded_offer_id uuid;

do $$ begin
  alter table public.projects
    add constraint projects_awarded_offer_fk
    foreign key (awarded_offer_id) references public.offers(id) on delete set null
    deferrable initially deferred;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 10. Messages: kind + offer_id + quote_id (offer/quote cards in chat)
-- ---------------------------------------------------------------------
alter table public.messages
  add column if not exists kind     message_kind not null default 'text',
  add column if not exists offer_id uuid references public.offers(id) on delete set null,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

create index if not exists idx_messages_offer on public.messages(offer_id);
create index if not exists idx_messages_quote on public.messages(quote_id);

-- ---------------------------------------------------------------------
-- 11. Bump completed_jobs_count when a project transitions to completed
-- ---------------------------------------------------------------------
create or replace function public.bump_contractor_completed_jobs()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    -- Try awarded_quote first, then awarded_offer (if sent by a contractor),
    -- then any accepted offer from a contractor on this project.
    select coalesce(
      (select q.contractor_id from public.quotes q where q.id = new.awarded_quote_id),
      (select o.sender_id from public.offers o
        where o.id = new.awarded_offer_id and o.sender_role = 'contractor'),
      (select o.sender_id from public.offers o
        where o.project_id = new.id
          and o.status = 'accepted'
          and o.sender_role = 'contractor'
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

drop trigger if exists trg_projects_completed_jobs on public.projects;
create trigger trg_projects_completed_jobs
  after update of status on public.projects
  for each row execute function public.bump_contractor_completed_jobs();

-- ---------------------------------------------------------------------
-- 12. Storage buckets for new image surfaces (public read).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('contractor-portfolio', 'contractor-portfolio', true),
  ('contractor-cover',     'contractor-cover',     true),
  ('contractor-logo',      'contractor-logo',      true),
  ('review-photos',        'review-photos',        true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 13. Lock down trigger-only SECURITY DEFINER helpers so they aren't
--     callable via PostgREST RPC (Supabase advisor 0028/0029).
-- ---------------------------------------------------------------------
revoke execute on function public.bump_contractor_completed_jobs() from anon, authenticated, public;
revoke execute on function public.recalc_contractor_rating()       from anon, authenticated, public;
alter function public.bump_contractor_completed_jobs() set search_path = public, pg_catalog;
alter function public.recalc_contractor_rating()       set search_path = public, pg_catalog;
