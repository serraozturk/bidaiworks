# bidAI — local setup walkthrough

A 10-minute guide to running the MVP on your laptop, with screenshots-style steps for the Supabase pieces.

## 1. Install dependencies

```bash
cd bidAI
npm install
```

## 2. Create a Supabase project

1. Go to <https://supabase.com> and sign in (free tier works).
2. **New project** → pick a region close to your users (US East / US West for the US market).
3. Set a strong database password — Supabase needs it for migrations.
4. Wait ~2 minutes for the project to provision.

## 3. Get your API keys

In the Supabase dashboard:

- **Settings → API** copy:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only — keep secret)

## 4. Run the schema

Two options:

### Option A — paste into the SQL editor (easiest)

1. In the dashboard, open **SQL Editor → New query**.
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`, paste, click **Run**.
3. Open another query, paste `supabase/seed.sql`, click **Run** (this loads the renovation categories).

### Option B — Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
psql "$(supabase db url)" -f supabase/seed.sql
```

## 5. Create the photo storage bucket

Photos uploaded by homeowners are stored in Supabase Storage.

1. **Storage → New bucket**.
2. Name: `project-photos`.
3. Toggle **Public bucket** on (so contractors can preview photos in their browse view).
4. Click **Create**.

> Later you'll likely want to lock this down with a per-project RLS-style policy. For the MVP, public-read is fine because nothing in the URL identifies the homeowner.

## 6. Get an Anthropic API key (optional but recommended)

- <https://console.anthropic.com> → API keys → Create key.
- Add as `ANTHROPIC_API_KEY` in `.env.local`.

> If you skip this, the AI estimate endpoint falls back to a hand-tuned heuristic so the rest of the app still works.

## 7. Configure environment

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, and ANTHROPIC_API_KEY
```

## 8. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## 9. Try the full flow

1. Click **I'm a homeowner**, sign up, create a project (any category, your real ZIP, a few photos).
2. Watch the AI estimate populate.
3. In an incognito window, click **I'm a contractor**, sign up, complete onboarding picking the same category and the same ZIP.
4. The contractor dashboard should now show the homeowner's project. Submit a quote.
5. Back in the homeowner window, refresh — the quote appears in the project detail. Accept it.
6. Use the **Message contractor** link to chat between the two windows.

## Troubleshooting

- **Categories don't show on the landing page** — you didn't run `seed.sql`. Run it in the SQL editor.
- **Sign-up sends a confirmation email** — by default Supabase requires email confirmation. Disable it under **Authentication → Providers → Email** while developing if you want auto-login.
- **Contractors can't see any projects** — RLS deliberately filters projects to those matching the contractor's categories AND ZIPs. Add the homeowner's ZIP to the contractor's service-area list.
- **Photo uploads fail** — confirm the bucket is named exactly `project-photos` and is set to public.

## Useful next steps

| Want to add… | Where |
| --- | --- |
| Stripe Connect payments | new `payments/` folder + `Stripe Connect` onboarding for contractors |
| Email + SMS notifications | a `lib/notify` helper using Resend (email) and Twilio (SMS); call it from after-insert triggers |
| Verified contractor badge | move `contractor_profiles.verified` from `false` to `true` after manual review or license API check |
| Generated DB types | `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts` then replace hand-written types in `src/lib/types.ts` |
