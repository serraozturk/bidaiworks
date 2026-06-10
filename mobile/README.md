# bidAI — Mobile (Flutter)

iOS + Android client for the bidAI home renovation marketplace. Connects to the **same Supabase backend** as the existing Next.js web app, so all data (projects, contractors, quotes, offers, messages, payments, reviews) stays automatically in sync between web and mobile.

The web app under `bidAI/` is **not modified** by this folder. The two clients live side-by-side and share Supabase as the single source of truth.

---

## What's inside

```
mobile/
├── pubspec.yaml                # Dart/Flutter dependencies
├── .env                        # SUPABASE_URL + SUPABASE_ANON_KEY (gitignored)
├── lib/
│   ├── main.dart               # Entry point
│   ├── core/
│   │   ├── theme/              # Vinted-style marketplace theme
│   │   ├── supabase/           # Supabase client init
│   │   ├── router/             # GoRouter with auth + role redirects
│   │   ├── utils/              # Formatters, constants
│   │   └── extensions/
│   ├── models/                 # 1:1 mirror of TypeScript types
│   ├── services/               # Auth, projects, quotes, offers, messages, payments, reviews, AI estimate
│   ├── providers/              # Riverpod state — realtime synced with Supabase
│   ├── widgets/                # Reusable cards, badges, inputs
│   └── screens/
│       ├── auth/               # Login, signup, splash
│       ├── onboarding/         # Homeowner + contractor onboarding
│       ├── homeowner/          # Projects, post project, contractors, offers, saved, compare, reviews
│       ├── contractor/         # Jobs feed, quotes, active jobs, profile, earnings, reviews
│       ├── messages/           # Conversation list + thread (Vinted-style with offer/quote cards)
│       ├── checkout/           # Deposit + escrow simulator
│       └── common/             # Settings
├── android/                    # Android platform config
├── ios/                        # iOS platform config
└── supabase/functions/ai-estimate/  # Edge function (Claude AI cost estimate)
```

---

## First-time setup

### 1. Install Flutter

Follow https://docs.flutter.dev/get-started/install (3.19+ required).

```bash
flutter --version   # should print 3.19+
flutter doctor      # fix any reported issues
```

### 2. Install dependencies

```bash
cd mobile
flutter pub get
```

### 3. Configure environment

The `.env` file already contains the production Supabase URL + anon key — they match the web app's `bidAI/.env.local`. Verify they're correct:

```bash
cat .env
```

If you need to point to a different Supabase project, edit `.env`.

### 4. Add fonts (one-time)

`pubspec.yaml` references the Inter font. Drop the four Inter `.ttf` files into `assets/fonts/`:

- `Inter-Regular.ttf`
- `Inter-Medium.ttf`
- `Inter-SemiBold.ttf`
- `Inter-Bold.ttf`

Free download: https://fonts.google.com/specimen/Inter

If you don't add fonts, Flutter will fall back to the system font silently — the app still runs.

### 5. Generate platform scaffolding (one-time)

The repo includes the editable platform files (Manifest, Info.plist, build.gradle, etc.). Run this once to fill in the auto-generated parts (gradle wrappers, Xcode project, etc.):

```bash
flutter create --platforms=android,ios --org com.bidai --project-name bidai .
```

This is **safe**: Flutter will only fill in missing files and leave anything that already exists alone.

---

## Run the app

### Android (emulator or device)

```bash
flutter run -d android
```

### iOS (Mac + Xcode required)

```bash
cd ios && pod install && cd ..
flutter run -d ios
```

### Both (live web preview)

```bash
flutter run -d chrome
```

---

## Deploy the AI-estimate Edge Function

The mobile app calls a Supabase Edge Function called `ai-estimate` for cost estimates. The web app's `/api/ai-estimate` route is left untouched — both endpoints use the same Claude prompt.

```bash
# from repo root
supabase functions deploy ai-estimate \
  --project-ref tnqwwkfloclyhwawitao \
  --import-map mobile/supabase/functions/ai-estimate/deno.json

supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  ANTHROPIC_MODEL=claude-haiku-4-5-20251001 \
  --project-ref tnqwwkfloclyhwawitao
```

If the function isn't deployed, the mobile app falls back to a heuristic estimate so the UX still works.

---

## Build for release

### Android APK / AAB

```bash
flutter build apk --release
flutter build appbundle --release   # for Play Store
```

### iOS IPA

```bash
flutter build ipa --release
```

Then upload `build/ios/ipa/*.ipa` to App Store Connect via Transporter or `xcrun altool`.

---

## Architecture notes

### Why Supabase directly?

Mobile talks directly to Supabase using `supabase_flutter`. Same auth (Supabase Auth), same RLS policies, same RPCs (`accept_quote`, `accept_offer`). This means:

- No API server in the middle, fewer moving parts
- Realtime out of the box (chat updates instantly via `streamMessages`)
- No drift between web and mobile — they read the same rows

### State management

Riverpod handles all state. Providers in `lib/providers/providers.dart`. Auth state drives the router — when a user signs in, the router invalidates `currentProfileProvider` and routes to the right home tab based on role.

### Roles are strict

The router and the bottom navigation are **completely separate** for homeowner vs contractor. No mixed UI, no role-confusion. A user signs up as one role and only sees screens for that role. RLS in Supabase enforces this server-side too.

### Two-way offers (Vinted-style)

Either side can send offers in the chat:

- **Homeowner** → `budget_offer` ("I'm hoping for $X")
- **Contractor** → `quick_offer` ("Ballpark $Y")
- Either → `counter_offer` (responds to a previous offer)

Acceptance goes through the `accept_offer` RPC which atomically:

1. Marks the offer accepted, all others rejected
2. Synthesizes a `quotes` row so checkout works uniformly
3. Sets `projects.status = 'awarded'`

After award, the chat hard-locks to system messages only — same as the web app.

### Payments

Simulated card flow (matches the web app). Deposit goes into `payments` with `status='held'`. When the project is marked completed, the `release_escrow_on_completion` trigger flips it to `released` and the contractor sees it in their balance.

---

## Sanity checklist before publishing

- [ ] Replace bundle identifier `com.bidai.app` with your own org's identifier in:
      - `android/app/build.gradle` (`applicationId`)
      - `ios/Runner.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`)
- [ ] Generate proper app icons via `flutter_launcher_icons` package
- [ ] Set up signing keys for both stores
- [ ] Configure Supabase Auth → URL configuration → add the deep-link scheme `bidai://auth-callback` to allowed redirects
- [ ] Verify the AI-estimate edge function is deployed and `ANTHROPIC_API_KEY` is set
