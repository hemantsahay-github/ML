# Estima — Personal Property Decision Engine

## Problem Statement
Personal property buying options and decision making and managing — comparing a flat with other options (villa/plot/rent/MF/equity).

## Core Requirements (static)
- Full suite: property comparison with weighted scoring + rent-vs-buy + EMI + investment compare (property vs MF vs equity)
- AI advisor (Claude Sonnet 4.5 via Emergent Universal LLM key)
- JWT email/password auth (cookie-based)
- INR (₹) default
- Design: Warm Editorial Dark theme (Cormorant Garamond + Outfit, terracotta #C85A32 + muted gold #B89B72 on #0A0908)

## User Personas
- First-time Indian home buyer evaluating 2–4 flats
- Investor deciding between a second property vs MFs/equity
- Couple stuck between renting for 5 more years vs buying now

## Architecture
- Backend: FastAPI (server.py), MongoDB (motor), bcrypt+PyJWT auth, emergentintegrations LlmChat
- Frontend: React 19 + React Router 7, Tailwind, shadcn/ui primitives, Recharts, Framer Motion, Phosphor icons
- Auth: httpOnly cookies (access 24h, refresh 7d), brute-force lockout (5 fails → 15 min)

## Implemented (2026-04-18)
- Backend endpoints:
  - /api/health, /api/auth/{register,login,logout,me,refresh}
  - /api/properties CRUD
  - /api/calc/{emi,rent-vs-buy,investment-compare}
  - /api/compare/score
  - /api/advisor/{chat,history}
- Frontend pages: Landing, Login, Register, Dashboard, Properties (drawer form), Compare (radar+bar+table), Calculators (3 tabs with Recharts), Advisor (chat with Claude)
- Admin seed (admin@estima.com / Admin@123), indexes on startup
- Deployment-ready: verified by deployment_agent

## Test Status
- Backend: 22/22 passed (iteration_1.json)
- Frontend: 95% — all core flows work end-to-end, logout timing is a cosmetic race

## Backlog / Next
- P1: CSV/PDF export of comparison report
- P1: Share comparison via public link (read-only)
- P1: City-wise default appreciation/rent presets (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune)
- P2: Loan prepayment scenarios (bullet vs stepped)
- P2: Mobile-responsive dashboard polish
- P2: Suppress recharts width/height console warning
- P2: Tighten CORS to explicit origin for production (currently regex=".*")
- P2: Split server.py by domain for maintainability

## 2026-04-18 — Portfolio (Owned Properties) Feature
- Property model extended: `status` (evaluating|owned), `purchase_date`, `purchase_price`, `current_value`, `current_loan_balance`, `monthly_rent_income`, `rented`
- New `GET /api/portfolio/summary` — totals (current value, equity, loan balance, appreciation %, net monthly cashflow) + per-property breakdown
- New `/app/portfolio` page with 4 summary tiles, pie chart (2+ properties), per-asset cards, insight strip
- Properties page: `evaluating` / `owned` tabs + status badge on cards
- Properties form: Status toggle with conditional owned-fields (purchase date/price, current value, outstanding loan, rented + rent income)
- Dashboard: 4-metric grid now including owned portfolio value + equity
- Tests: 14/14 backend passed (iteration_3.json)

## 2026-04-18 — Razorpay + Pro tier + Admin + Guide + Cashflow Finder + vs Markets
**Billing & Membership:**
- Razorpay test keys wired (`rzp_test_Sf6hLVUPI1DcI3`). Plans: Free ₹0, Pro Monthly ₹999, Pro Yearly ₹9,999
- 10-day free Pro trial auto-created on register (user.plan='pro', plan_status='trial', trial_ends_at=+10d)
- Endpoints: /api/billing/plans, /me, /create-order, /verify-payment (HMAC SHA256), /cancel
- Pro-gated: /api/advisor/chat, /api/compare/export/csv, /api/compare/export/pdf (402 on non-Pro)
- Admin account seeded as permanent Pro (100-year expiry)

**Admin dashboard** (/app/admin, role=admin only):
- Overview: user stats, revenue, property totals
- Users table with actions: promote/demote admin, grant/cancel Pro
- Transactions table

**New calculators & analysis:**
- /api/calc/cashflow-positive (public) — reverse-solves max property price for rent-covered EMI+costs
- /api/portfolio/vs-investments — staggered CAGR comparison against Equity 13% / MF 11% / Gold 9% / Silver 8.5% / FD 7%

**Onboarding:**
- Auto-launched Tour modal on first login (6 steps, localStorage persistence, data-testid='tour-modal')
- /app/guide page with feature reference + FAQ + "Run the tour again" button
- Floating help FAB bottom-right (repositioned to right-24 to avoid Emergent badge)

**Tests:** iteration_5.json — 34/34 backend pass, frontend 100% after FAB z-index fix.

## 2026-04-18 — Referrals · Resale · Loan Optimizer · Enhanced vs-Markets · Disclaimer
**Referrals:**
- Auto-generated referral_code per user. Register with ?ref=CODE grants referrer +30 days Pro immediately.
- GET /api/referrals/me (code, event log, totals). /app/referrals page with Copy+Share buttons and stats.

**Resale estimator (/api/calc/resale-estimate):**
- Breakeven sale price and target-profit sale price after broker fee + LTCG + net carrying cost.
- Projected net-in-hand at assumed appreciation and implied CAGR on capital invested.

**Loan optimizer (/api/calc/loan-optimizer):**
- Sweeps down-payment 5-100% in 5% steps. Surfaces cashflow-neutral DP%, max cashflow, best cash-on-cash ROI.

**vs-markets extended:**
- Now includes sold properties (sold_price as terminal value) and owned rental income (accumulated year-by-year).
- property_plus_rental series; winner computed including rental yield.

**Disclaimer:**
- Global <Disclaimer /> component (inline + compact). /disclaimer public page. Footer link on Landing.
- Added to Portfolio, Compare, Calculators, Referrals, Advisor (compact) pages.

**Tests:** iteration_6.json — 30/30 backend, 100% frontend.

## 2026-04-18 — Final batch: Google Auth · Tenants · Receipts · Builder Plan · Feedback · Demo videos
- POST /api/auth/google/session (Emergent OAuth fallback)
- Tenants CRUD + rent receipts (PDF) + email option
- Builder plan calculator (CLP · 10:90 · 20:80 · subvention)
- Floating feedback widget (FAB + admin moderation at /api/admin/feedback)
- Admin extend_trial action
- Landing demo videos section (placeholder → 'Coming soon')
- Notifications module (Resend + Twilio **MOCKED** — logs to stdout)
- **Tests:** iteration_7.json — 24/24 backend, frontend 100% (after rick-roll fix).

## 2026-04-18 — Long-game math + Under-construction + Projects directory
**New calculators:**
- POST /api/calc/wealth-narrative — 25-year buy-vs-rent with tier-1 premium (+15%), rent inflation, EMI expiry, generational-transfer legacy bonus. Returns crossover_year + narratives array.
- POST /api/calc/rent-for-cashflow — finds rent needed for owned property to turn CF-positive in N years; 15-year trajectory.
- POST /api/calc/prepayment-analysis — 4 scenarios (part / full / invest / part+invest-savings) with winner detection. Takes rental income + maintenance + tax for owned-rental cashflow delta.

**Extended calculators:**
- /api/calc/loan-optimizer now supports `under_construction=true` with `possession_months`, `disbursement_schedule` (clp|linear), `subvention_by_builder`. Grid rows include `pre_emi_total` and `pre_emi_monthly`.
- /api/calc/resale-estimate accepts `min_rent_monthly`, `current_rent_monthly` (uses avg) and `misc_expenses_inr` (one-time renovation/repair). Response includes `average_rent_used` and `misc_expenses`.

**Upcoming projects directory:**
- /app/backend/city_projects.py — 15 curated tier-1 projects (BLR/MUM/NCR/HYD/PUN/CHN/KOL/AMD) with builder, possession, config, ticket, RERA, amenities.
- GET /api/builder-projects?city=&area=&status= — filterable; merges curated + community.
- POST /api/builder-projects/community (auth) — user-submitted projects.
- New /app/projects page with filter bar + submit modal.

**Landing page:**
- Added "Why buying wins over 25 years" teaser (4 cards: finite land / rent compounding / EMI expiry / generational transfer) with CTA to Wealth Narrative calculator.
- Demo videos section no longer links to YouTube rick-roll — now marked "Coming soon".

**Tests:** iteration_8.json — 12/12 backend, 100% frontend on all new flows.
