# bidAI — Home Renovation Marketplace (MVP)

A two-sided marketplace where US homeowners post renovation projects, get an AI cost estimate, and receive quotes from matching contractors.

## Stack

- **Next.js 14** (App Router, TypeScript, Server Components)
- **Supabase** — Postgres database, Auth, Storage (photos), Row Level Security
- **Tailwind CSS** — styling
- **Anthropic Claude API** — AI cost estimation
- **Vercel** — hosting target

## MVP scope (v1)

### Homeowner can
- Sign up / log in
- Create a project request: category, ZIP, description, photos, budget hint
- Get an AI-generated estimated cost range
- Browse matching contractors (by category + service area)
- Receive and compare quotes
- Message contractors
- Accept a quote (chooses a contractor)
- Leave a review when project is marked complete

### Contractor can
- Sign up / log in as contractor
- Build a company profile: name, license #, bio, years in business
- Pick service categories and service-area ZIPs
- Upload portfolio photos / logo
- Browse open project requests filtered by their categories + service areas
- Submit quotes (amount, timeline, message)
- Message homeowners
- Track quote status (pending / accepted / rejected)

### Out of scope for v1 (later phases)
- Payments / escrow / invoicing
- Background checks / license verification
- Native mobile apps
- Disputes / admin moderation tools
- Subscription tiers for contractors
- Push notifications / SMS
- Calendar / scheduling

## Repository layout

```
bidAI/
├── supabase/
│   ├── migrations/        SQL migrations (run in order)
│   └── seed.sql           Demo categories + sample data
├── src/
│   ├── app/               Next.js App Router pages
│   │   ├── (auth)/        Login / signup
│   │   ├── onboarding/    Role-specific onboarding flows
│   │   ├── dashboard/     Authenticated app
│   │   └── api/           Server routes (AI estimate, etc.)
│   ├── components/        Reusable UI
│   ├── lib/               Supabase clients, AI helpers, types
│   └── middleware.ts      Auth gate
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── .env.local.example     Copy to .env.local
```

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create a Supabase project at https://supabase.com
#    Copy your project URL + anon key + service-role key.

# 3. Configure environment
cp .env.local.example .env.local
# Fill in the Supabase + Anthropic keys

# 4. Run database migrations
#    Option A: paste supabase/migrations/*.sql into the Supabase SQL editor
#    Option B: install the Supabase CLI and run `supabase db push`

# 5. Start dev server
npm run dev
```

Open http://localhost:3000.

## Database overview

Core tables (full schema in `supabase/migrations/001_initial_schema.sql`):

- `profiles` — every user; tracks role (`homeowner` | `contractor`)
- `categories` — renovation types (kitchen, bath, roofing, etc.)
- `contractor_profiles` — company info for users with role `contractor`
- `contractor_categories` — many-to-many: which categories a contractor serves
- `contractor_service_areas` — ZIP codes a contractor covers
- `projects` — homeowner project requests
- `project_photos` — photos attached to a project
- `quotes` — contractor's offer on a project
- `conversations` / `messages` — homeowner ↔ contractor chat
- `reviews` — homeowner reviews of a contractor after project completion

Row-Level Security policies keep each user's data isolated. See the migration file for the full set.

## Roadmap after MVP

1. Payments (Stripe Connect) + escrow milestones
2. Verified badges (license check, insurance proof)
3. Notifications (email + SMS via Resend / Twilio)
4. Calendar / scheduling for site visits
5. Mobile app (React Native, sharing the same backend)
6. Admin dashboard for moderation, disputes, fraud signals
