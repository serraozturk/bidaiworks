# bidAI — Marketplace Launch Readiness Checklist

A full requirements list for a real two-sided home-renovation marketplace,
checked against what bidAI has today. Use it to decide what to build before
a public deployment.

**Status legend**

- **Built** — exists and works in the project today.
- **Partial** — some of it exists, but not enough to rely on at launch.
- **Missing** — not in the project; needs to be built.

> Quick read: bidAI is strong on the *negotiation → payment → commitment → job*
> flow, the audit trail, the admin **visibility**, and having both web + mobile.
> The launch-blocking gaps are **real payments**, **moderation/approval tools**,
> **notifications**, **support/dispute handling**, and **legal pages**.

---

## 1. Accounts & authentication

| Requirement | Status | Notes |
|---|---|---|
| Email/password sign up & login | Built | Supabase auth, signup/login pages |
| Homeowner vs contractor roles | Built | `profiles.role`, enforced in routing & RLS |
| Session handling | Built | `middleware.ts` refreshes the session |
| Email verification (enforced) | Partial | Supabase supports it; not enforced before use |
| Forgot / reset password | Missing | No reset flow in the app |
| Account deletion & data export | Missing | Needed for GDPR/CCPA before deploy |
| Social / Google login | Missing | Optional, not required for launch |

## 2. Onboarding & profiles

| Requirement | Status | Notes |
|---|---|---|
| Homeowner onboarding | Built | `onboarding/homeowner` |
| Contractor onboarding (company, categories, service areas) | Built | `onboarding/contractor` |
| Contractor license / insurance capture | Partial | Fields exist (`license_status`, `insurance_status`); no review or proof upload |
| Contractor verification (the "verified" badge earned) | Partial | `verified` flag exists but nothing sets it — see §4 |
| Profile editing | Built | Settings + contractor profile editor |

## 3. Projects & matching

| Requirement | Status | Notes |
|---|---|---|
| Homeowner posts a project with a detailed brief | Built | Category, scope, quality, materials, photos, measurements, access notes |
| Required-photo checklist | Built | `project_required_photos` |
| AI cost estimate | Built | Anthropic-powered estimate on post |
| Contractor lead matching (category + service area) | Built | Enforced via RLS |
| Project moderation / admin approval before it goes live | **Missing** | You asked for this — see §4 & §13 |
| Search, sort, advanced filters | Partial | Basic ZIP/category filtering only |

## 4. Trust, safety & moderation

| Requirement | Status | Notes |
|---|---|---|
| Off-platform contact blocking in chat | Built | DB trigger blocks phone/email/links before checkout |
| One active deal per project, negotiation lock | Built | DB unique index + RLS |
| Full negotiation/payment audit trail | Built | `marketplace_events` + admin audit log |
| Admin approval queue for new projects | **Missing** | New projects go live as `open` immediately |
| Contractor verification workflow (admin reviews docs → marks verified) | **Missing** | No admin action to verify; `verified` is never set |
| Gate: only verified contractors can send offers | **Missing** | Unverified contractors can bid today |
| Report / flag a project, message, or user | **Missing** | You asked for a "do you have a problem" path |
| Suspend / ban an account | **Missing** | Admin cannot disable a bad actor |
| Review moderation | Missing | Reviews publish with no check |
| Profanity / abuse filtering | Missing | Only contact-info is filtered |

## 5. Visibility & access rules

| Requirement | Status | Notes |
|---|---|---|
| Contractor identity hidden in chat until checkout | Built | DealPanel/MessageThread hide names pre-checkout |
| Homeowner street address revealed only to the booked contractor | Partial | Stored separately; confirm it is never exposed earlier |
| Rule: homeowner can't open a contractor's full profile before a deal | **Missing** | `contractor_profiles` is currently world-readable — a deliberate access-rule decision is needed |
| Contractors only see projects they're matched to | Built | RLS scopes the lead feed |

## 6. Negotiation & offers

| Requirement | Status | Notes |
|---|---|---|
| Structured offers, counters, expiry | Built | Offers system + lazy expiry |
| Accept → checkout → commitment flow consistent across web + mobile | Built | Shared RPCs `homeowner_pay_project` / `contractor_pay_commitment` |

## 7. Payments, escrow & payouts

| Requirement | Status | Notes |
|---|---|---|
| Checkout & escrow logic | Built | Project amount + protection hold held, released on completion |
| Contractor 8% commitment fee | Built | 48h window, re-opens on lapse |
| **Real payment processor (Stripe/etc.)** | **Missing** | All payments are simulated/test mode — launch blocker |
| **Real payouts to contractor bank accounts** | **Missing** | `withdrawals` table only; no real transfer |
| Refunds via the processor | Missing | Refund is a DB status change only |
| Invoices / receipts | Missing | No document issued to either side |
| Tax handling (contractor 1099s, sales tax) | Missing | Required once real money moves |
| PCI compliance | Missing | Use Stripe Elements/Checkout so card data never touches your server |

## 8. Disputes & cancellations

| Requirement | Status | Notes |
|---|---|---|
| Homeowner/contractor can raise a dispute | **Missing** | `payment_status` has a `disputed` value but no flow uses it |
| Admin dispute-resolution tooling | Missing | Admin cannot adjudicate or release/refund escrow |
| Cancellation policy & flow | Partial | Projects can be cancelled; no rules on refunds/penalties |

## 9. Reviews & reputation

| Requirement | Status | Notes |
|---|---|---|
| Homeowner reviews contractor after completion | Built | Multi-dimensional ratings |
| Contractor reviews homeowner (two-sided) | Missing | Only one direction today |
| Ratings shown on contractor profiles | Built | Aggregated rating fields |

## 10. Communication & notifications

| Requirement | Status | Notes |
|---|---|---|
| In-app real-time chat | Built | Supabase realtime |
| Unread message indicators | Partial | Counts exist; not everywhere |
| **Email notifications** (new offer, accepted, paid, commitment due, message) | **Missing** | Critical — users won't return without them |
| Push notifications (mobile) | Missing | No FCM/APNs wiring |
| Reminders (payment window, 48h commitment window) | Missing | Expiry is lazy; no proactive nudge |

## 11. Support & help

| Requirement | Status | Notes |
|---|---|---|
| "Report a problem" / contact support | **Missing** | You asked for this for homeowners and contractors |
| Help center / FAQ | Missing | No self-serve help |
| Support inbox / ticketing for the team | Missing | Pairs with the report flow |

## 12. Admin & operations

| Requirement | Status | Notes |
|---|---|---|
| Admin can see all conversations, contractors, projects, payments | Built | The `/admin` panel |
| Audit log of all activity | Built | `/admin/events` |
| **Admin can take action** (approve, reject, verify, suspend, refund) | **Missing** | The admin panel is read-only today |
| Project approval queue UI | **Missing** | — |
| Contractor verification UI | **Missing** | — |
| Metrics / analytics for the team | Partial | Overview stat cards only |

## 13. Legal & compliance

| Requirement | Status | Notes |
|---|---|---|
| Terms of Service | Missing | Required before public launch |
| Privacy Policy | Missing | Required (handling personal data) |
| Cookie / tracking consent | Missing | — |
| Contractor & homeowner agreements | Missing | Defines escrow, fees, liability |
| Marketplace liability / insurance disclaimers | Missing | — |
| Data retention policy | Missing | — |

## 14. Observability & quality

| Requirement | Status | Notes |
|---|---|---|
| Error tracking (e.g. Sentry) | Missing | No visibility into production errors |
| Product analytics | Missing | No funnel/conversion tracking |
| Database backups | Built | Managed by Supabase |
| Automated tests | Missing | No test suite |
| Pagination on long admin/list views | Partial | Admin pages load all rows — fine now, not at scale |
| Rate limiting / abuse throttling | Missing | — |

## 15. Mobile (iOS & Android)

| Requirement | Status | Notes |
|---|---|---|
| Flutter app synced to the backend | Built | Checkout, commitment, statuses, chat |
| App store assets & privacy labels | Missing | Icons, screenshots, store metadata, data-safety forms |
| Push notification setup | Missing | See §10 |
| Device/build testing | Pending | Needs `flutter build` + real-device QA |

---

## Launch-blocking priorities (do these before a public deploy)

1. **Real payments & payouts** — integrate Stripe (Checkout/Connect); without it no real money can move.
2. **Admin moderation tools** — project approval queue, contractor verification, suspend/ban; turn the admin panel from read-only into an action panel.
3. **Email notifications** — at minimum: new offer, offer accepted, payment received, commitment-fee due, new message.
4. **Support & reporting** — a "report a problem" path for both roles + a basic dispute flow.
5. **Legal pages** — Terms, Privacy, and the contractor/homeowner agreements.
6. **Error tracking** — Sentry (or similar) so you can see production failures.

## Strongly recommended (soon after launch)

Password reset · account deletion/export · review & content moderation ·
two-sided reviews · reminders for payment/commitment windows · pagination ·
rate limiting · the "homeowner can't see contractor profile before a deal"
access rule.

---

## Your specific requests — where they land

| You asked for | In the project? | Plan |
|---|---|---|
| Admin more active — check/verify before a project is accepted | Missing | Add a project-approval queue: new projects start as `pending_review`, contractors only see them once an admin approves |
| Admin verification & "control everywhere" | Missing | Add admin actions: verify contractors, approve/reject projects, suspend accounts, resolve disputes |
| Admin dashboard UI "not enough" | Partial | Rebuild admin pages with action buttons + a moderation queue, not just tables |
| Rule: homeowner can't see a contractor's page before accepting | Missing | Tighten `contractor_profiles` visibility / add a gate |
| "Do you have any problems" for contractor & homeowner | Missing | Add a Report / Support section for both roles |
