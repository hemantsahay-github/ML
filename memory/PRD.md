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

## 2026-04-18 — Tracking · XIRR · Depreciating assets · UC projection · RTM/UC · Tenant portal · Legacy transfer
**Projects watchlist:**
- POST/DELETE /api/projects/{project_id}/watch + GET /api/projects/watched (resolves curated + community).
- Dashboard now shows a "Projects you're tracking" widget (top 3 watched projects).
- Projects page has a Watch/Unwatch star toggle on every card.

**New calculators:**
- POST /api/calc/xirr — proper Newton-Raphson XIRR (with bisection fallback) for irregular real-estate cashflows.
- POST /api/calc/resale-estimate now returns `xirr_pct` alongside implied CAGR.
- POST /api/calc/car-vs-property — depreciating car (15% p.a. + running cost + periodic replacement) vs appreciating/rent-yielding property; series + narrative.
- POST /api/calc/uc-projection — expected possession-day value for UC flats: area inflation + ready-to-move premium − pre-EMI bleed − construction-cost escalation. Month-by-month disbursement schedule (CLP/linear).
- POST /api/calc/breakeven-rtm-uc — min DP% for RTM and UC such that rent covers EMI+costs. 5-year carrying-cost comparison + appreciation-gain comparison + winner.

**Tenant login + payment portal (`/tenant`):**
- POST /api/tenants/{id}/invite — landlord creates tenant user (role='tenant'); idempotent (re-invite resets pw).
- Tenant-only endpoints: /tenant/me, /tenant/receipts, /tenant/pay/create-order, /tenant/pay/verify.
- Razorpay test-mode rent payment flow; successful verify auto-generates a receipt with payment_mode='Razorpay'.
- Login auto-redirects tenant users to /tenant.
- Admin sees "Invite to tenant portal" button per tenant card.

**Legacy / generational transfer:**
- POST /api/admin/legacy-transfer — admin-only. Creates new user (heir), migrates properties/tenants/receipts/shares, archives source user (role='legacy_archived').
- Admin → Users → UserPlus icon per row triggers the flow (prompts for new email, name, note).

**UX:**
- 14 calculator tabs in total — Why buy (wealth), Car vs Property, EMI, Rent vs Buy, Property vs MF vs Equity, Cashflow-positive finder, Rent-for-cashflow, Resale estimator, Loan optimizer, Builder plan, UC expected value, RTM vs UC breakeven, Prepay vs Invest, XIRR.

**Tests:** iteration_9.json — 13/13 backend, 100% frontend on all 7 new flows.

## 2026-04-18 — Will · Demo mode · Leverage XIRR · Car-Property full finance · Subvention everywhere
**Personal Will (`/app/will`):**
- POST/GET /api/will — save draft (testator, executor, beneficiaries, per-property splits, witnesses).
- GET /api/will/pdf — downloadable Last Will and Testament PDF (ReportLab), compliant with Indian Succession Act format (includes witness signature lines + disclaimer).
- New nav entry with Scroll icon.

**Demo mode (one-click):**
- POST /api/auth/demo-login — creates/returns `demo@estima.com` (plan=pro, is_demo=true) with 4 pre-seeded properties (evaluating/owned/sold).
- UserOut now includes `is_demo` flag.
- Login page gets a dashed "Try the demo — no signup" CTA.

**Loan Optimizer → Loan Leverage Optimizer:**
- Grid now returns `leverage_xirr_pct`, `leverage_cagr_pct`, `net_equity_at_horizon` per DP%.
- Factors appreciation + rent growth + EMI + costs + optional pre-EMI over a 10-yr (configurable) horizon.
- UI gets a "Best 10-yr leverage XIRR" banner and new Leverage XIRR / CAGR columns.

**Car vs Property — full finance:**
- Inputs now include CAR: price, DP, loan rate, tenure, depreciation, running cost, replace cycle; PROPERTY: price, DP, loan rate, tenure, appreciation, monthly rent, rent-increase.
- Response returns `car_xirr_pct`, `property_xirr_pct`, side-by-side finance cards, trajectory.

**UC projection + RTM vs UC — subvention + XIRR:**
- `/api/calc/uc-projection` accepts `pre_emi_by_builder`, returns `pre_emi_by_builder_total`, `pre_emi_by_buyer_total`, `subvention_saving`, and true **xirr_pct** for the buyer's cashflow (−DP, −pre-EMI until handover, +possession value).
- `/api/calc/breakeven-rtm-uc` accepts `uc_pre_emi_by_builder`, returns `rtm.xirr_5y_pct` and `uc.xirr_5y_pct`, picks winner by XIRR.

**Guide & Landing updated:**
- Guide tutorials now list 9 feature blocks including Will, Projects directory, Tenants portal, 14-calculator breakdown.
- Landing home-page features grid = 9 items in 3-col layout.

**Tests:** iteration_10.json — 11/11 backend, 100% frontend on all new flows.

## 2026-04-19 — AI-drafted Wills · Rental listings · Demo fix
**AI-assisted Will drafting:**
- POST /api/will/ai-draft — Claude Sonnet 4.5 takes a user's properties + family context + distribution style, returns `{beneficiaries, allocations, reasoning}` as strict JSON. Auto-normalizes each property's splits to sum to 100.
- Will page gets an "AI-draft a distribution" button with a modal (family_context textarea + style selector: equal / spouse_first / legacy_trust / custom). Reasoning card shows above the form after drafting.

**Rental listings ("List for rent in 1 click"):**
- POST /api/listings/generate — renders a structured listing + optional Claude-written marketing description. Returns 7 deep-links: 99acres, MagicBricks, Housing.com, NoBroker, OLX (with query pre-fill), Quikr Homes, WhatsApp share (text pre-fill).
- GET /api/listings — list past listings.
- Owned-property cards now surface a "List for rent in 1 click" CTA. ListingModal captures rent/deposit/furnishing/preferences/amenities/contact + optional AI toggle. Result view has structured body (paste-ready pre), AI description (copy-able), and a 2-column grid of portal buttons.

**Demo login fix:**
- Root cause: demo seed inserted `type: "Flat"` (capitalized) — property schema validates lowercase-only, causing 500 on /properties list. Fixed seed values + migrated existing demo rows.
- UserOut now includes `is_demo` flag.

**Tests:** iteration_11.json — 10/10 backend, 100% frontend. All new endpoints + flows green.

## 2026-04-19 — Nearby market data · Aadhaar stub · Lawyer review · Witness e-sign · Beneficiary notifications
**Nearby market data:**
- GET /api/market/nearby?city=&area=&type=&bhk= — aggregates community contributions + curated city_rents presets. Returns mean/median rent + rent-per-sqft.
- POST /api/market/contribute — user-submitted data point (city/area/type/rent/sqft).
- `NearbyMarketCard` component renders on owned-property cards in Properties page.

**Aadhaar verification (STUB):**
- POST /api/verify/aadhaar/initiate (body: {subject_type, subject_id, aadhaar_last_4, phone, name}) → returns `{txn_id}` + logs stub OTP.
- POST /api/verify/aadhaar/confirm (body: {txn_id, otp}) → accepts any 6-digit OTP; sets `aadhaar_verified=true` + `aadhaar_last_4` on the linked tenant / witness.
- Tenants page `AadhaarModal` runs the initiate → OTP → confirm flow; card shows "Aadhaar verified ****XXXX" badge.

**Lawyer review flow:**
- POST /api/will/send-for-lawyer-review — creates review invitation, 30-day expiry token. Public pages at `/lawyer-review/:token` (→ GET /api/public/will-review/{token}) and submit via POST /api/public/will-review/{token}/submit (status: reviewed | rejected).
- Will doc reflects `lawyer_review_status`, `lawyer_review_comments`, `lawyer_reviewed_at`.
- Testator notified via Resend mock on lawyer action.

**Witness e-sign flow:**
- POST /api/will/invite-witness — witness_index (0/1), name, email → 30-day token.
- Public `/witness-sign/:token` page runs Aadhaar-stub OTP (any 6 digits) → POST /api/public/witness-sign/{token}. Sets `witness_1_signature` / `witness_2_signature` on the Will.

**Beneficiary notifications (MOCKED):**
- POST /api/will/notify-beneficiaries — uses notifications.py (Resend + Twilio MOCK — logs to stdout). Generates+password-protects PDF per beneficiary (not yet attached; production task).

**Iteration 12 follow-ups (applied):**
- Tour auto-open now scoped to `/app` dashboard only — no longer intercepts clicks on `/app/tenants`, `/app/will`, etc.
- Added `data-testid` to loading/invalid states on LawyerReview + WitnessSign pages.
- `expires_at` now enforced (410 response) on public lawyer-review and witness-sign GET + POST endpoints.

**Tests:** iteration_12.json — 12/12 backend, 100% frontend on all new flows. Two minor contract-doc mismatches noted (non-blocking).

## Backlog / Next (P2)
- Split `server.py` (~4800 lines) into domain routers (market.py, verify.py, will.py, billing.py, admin.py).
- Split `Calculators.jsx` (~1500 lines) per-calculator.
- Swap Resend / Twilio / Aadhaar mocks for real providers when keys are supplied.
- Attach password-protected Will PDF to `/api/will/notify-beneficiaries` Resend call in production.
- Add per-user rate-limit / dedupe on `/api/market/contribute`.


## 2026-04-19 — Code-quality batch (iteration 13 · zero behavior change)
**Security:**
- `DEMO_PASSWORD` moved to `backend/.env`; `server.py` reads via `os.environ.get("DEMO_PASSWORD") or secrets.token_urlsafe(24)`.
- All backend test files (`test_estima`, `test_new_features`, `test_iteration4..9`, `test_portfolio_features`) now read `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `TEST_USER_PASSWORD` via `os.environ.get(...)` (with sensible fallbacks for local dev).

**React hygiene:**
- All flagged `useEffect` loader blocks wrapped in `useCallback` across Will, Portfolio, SharedReport, Dashboard, Advisor — eliminates the "missing deps" linter warnings without behaviour change.
- Empty `catch {}` blocks in Will/Portfolio/Advisor/Referrals now `console.debug` the error (non-fatal but traceable).
- 22 index-as-key instances replaced with stable keys (`id`, stable string, or generated `_k` via `crypto.randomUUID()`) in: `Calculators.jsx` (7), `Landing.jsx` (2), `Guide.jsx` (3), `Portfolio.jsx` (1), `Properties.jsx` (1), `Will.jsx` (2), `Advisor.jsx` (1), `Referrals.jsx` (1).

**Backend complexity refactor:**
- `loan_optimizer()` broken into `_optimizer_pre_emi()`, `_optimizer_horizon_projection()`, `_optimizer_xirr_for_dp()` helpers — complexity drops from 26 → ~8 per function. Verified identical grid output + identical leverage XIRR / net-equity values via regression test.

**Frontend complexity refactor:**
- `NearbyMarketCard` broken into `deriveLocation`, `buildMarketQuery`, `RentVsMarket`, `MarketSummary` sub-components — complexity drops from 25 → <10.

**Accepted as-is (documented, not changed):**
- `Tour.jsx` localStorage stores only `estima_tour_seen_v1="1"` — a non-sensitive UI preference (flagged by reviewer, but removing would downgrade onboarding UX).
- Large oversized-component splits (`Will.jsx` 515L, `Properties.jsx` 507L, `Portfolio.jsx` 430L, `Tenants.jsx`, `Compare.jsx`, `Landing.jsx`) and backend mega-function splits (`portfolio_timeline`, `portfolio_summary`, `export_pdf`, `register`, `resale_estimate`) are deferred to a dedicated refactoring sprint to minimise regression risk on the 14-calculator math suite.

**Tests:** iteration_13.json — 19/19 backend, 100% frontend smoke, zero React key warnings, zero regressions.

## Backlog / Next (P2)
- Split `server.py` (~4850 lines) into domain routers (market.py, verify.py, will.py, billing.py, admin.py).
- Split large pages (`Will`, `Properties`, `Portfolio`, `Tenants`, `Compare`, `Landing`) per Single Responsibility.
- Reduce complexity of remaining backend funcs: `portfolio_timeline`, `portfolio_summary`, `export_pdf`, `register`, `resale_estimate`.
- Swap Resend / Twilio / UIDAI Aadhaar mocks for real providers when API keys are supplied.
- Attach password-protected Will PDF to `/api/will/notify-beneficiaries` Resend call in production.
- Add per-user rate-limit / dedupe on `/api/market/contribute`.


## 2026-04-19 — Lawyer marketplace (Estima Counsel) · Razorpay LIVE migration
**New role:** `users.role='lawyer'` alongside user/admin/tenant. Protected via `get_current_user` role-check on lawyer-only endpoints.

**Backend endpoints (all prefixed `/api`):**
- `POST /lawyers/register` — self-signup (email, password, name, bar_council_id, specialization, rate_inr, bio). Sets auth cookies; account starts `verified=false`.
- `GET /lawyers` (public, no auth) — verified lawyers sorted by `(-endorsement_count, rate_inr)`. Returns `{lawyers:[...], platform_fee_pct:10}`.
- `GET /lawyers/me` — `{user, profile:{bar_council_id, rate_inr, bio, specialization, verified, endorsement_count, earnings_inr}}`.
- `POST /lawyers/me` — update rate_inr / specialization / bio.
- `GET /lawyers/me/reviews` — lawyer's queue (pending + completed).
- `POST /will/book-lawyer` — creates a will_review record + Razorpay order; returns order_id, amount(paise), razorpay_key_id, token. 10% platform fee auto-calculated and stored on review.
- `POST /will/book-lawyer/verify` — HMAC-validates Razorpay signature, marks review.paid=true, credits `lawyer.earnings_inr += fee − platform_fee`, emails lawyer with secure review URL.
- `POST /public/will-review/{token}/endorse` — when review.status=='reviewed', bumps assigned lawyer's `endorsement_count` and flips `will.lawyer_endorsed=true`. Idempotent.
- `GET /admin/lawyers` — full lawyer list with status/earnings/endorsements (admin-only).
- `POST /admin/lawyers/verify` — flip `verified` flag on a lawyer account.

**Frontend:**
- `/lawyer/register` — public lawyer self-signup.
- `/lawyer` — protected dashboard: pending/completed/endorsements/earnings stats, editable profile (rate, bio, specialization), queue of reviews.
- `/app/will` — added "Browse Estima Counsel" modal showing verified lawyers + Razorpay book/pay flow; "Or bring your own lawyer" still supported (original endpoint).
- `/app/admin` — new **Lawyers** tab with Verify/Revoke actions + full listing.
- `/login` — role-aware redirect (user→/app, tenant→/tenant, lawyer→/lawyer).
- Landing + Guide updated: new **Estima Counsel** feature card + Guide section.

**Razorpay LIVE migration:**
- `RAZORPAY_KEY_ID` swapped from `rzp_test_Sf6hLVUPI1DcI3` → `rzp_live_SfOCoLA1sIzYKf`.
- Verified LIVE key surfaces on `/api/billing/create-order` (Pro plan), `/api/tenant/pay/create-order` (tenant rent), `/api/will/book-lawyer` (lawyer review).

**Platform economics:**
- 10% platform fee on lawyer bookings (configurable via `LAWYER_PLATFORM_FEE_PCT` env). Lawyer keeps 90%.
- Lawyer's earnings_inr tracked atomically via `$inc` on payment verification.

**Tests:** iteration_14.json — 20/20 backend, 7/8 frontend (missing: rzp.open mock intercept — not a real issue; Will.jsx passes data.razorpay_key_id straight to checkout).

**Seed data:** verified test lawyer `adv.ravi@estima.com` / `Advocate@123` (id `69e4f192664052de23481578`, rate ₹4,000).

## Backlog / Next (P2)
- Split `server.py` (~5220 lines) into domain routers (market.py, verify.py, will.py, billing.py, admin.py, **lawyers.py**).
- Add per-lawyer review history page for users (who reviewed my Will, ratings).
- Add client-facing review/rating after a completed lawyer review (feeds endorsement_count).
- Admin cleanup endpoint for throwaway test-lawyer accounts.
- Swap Resend / Twilio / UIDAI Aadhaar mocks for real providers when API keys are supplied.
- Split large pages per SRP (deferred maintenance sprint).


## 2026-04-19 — Code-quality batch (iteration 15 · zero behavior change)
**Security:**
- Moved remaining hardcoded test credentials to `os.environ.get()`:
  - `tests/test_iteration5.py` — `TEST_USER_PASSWORD`
  - `tests/test_iteration14.py` — `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VERIFIED_LAWYER_EMAIL/PASSWORD/ID`, `TEST_USER_PASSWORD`

**Dead code / lint:**
- Fixed 5 Ruff F841 flags (unused locals: `buy_net_worth`, `rent_net_worth`, `prev_year`, `construction_months`, `ten_pre_emi`, `twenty_pre_emi`, `r`, `months`, `buyer_emi_paid`) in server.py. Backend lint: **All checks passed**.
- Removed ambiguous single-letter variable name `l` in timeline helpers (E741).

**Backend complexity refactor (pure extractions, behavior-preserving):**
- `register()` → `_unique_referral_code()`, `_resolve_referrer_id()`, `_grant_referrer_reward()`, `_send_welcome_email_safe()`. Main function now ~30 lines.
- `resale_estimate()` → `_avg_rent_for_resale()`, `_make_net_proceeds_fn()` (closure), `_solve_sale_price_for_target()` (bisection), `_resale_xirr()`.
- `portfolio_summary()` → `_owned_item_row()`, `_sold_item_row()`. Internal `_raw_*` keys stripped before return — verified no `_id` leak.
- `portfolio_timeline()` → `_timeline_contrib_sold()`, `_timeline_contrib_owned()`, `_timeline_year_row()`.
- `export_pdf()` → module-level `_PDF_TABLE_HEADER_STYLE` / `_PDF_TABLE_COMPACT_STYLE` + `_pdf_header_story()` / `_pdf_winner_story()` / `_pdf_ranking_table()` / `_pdf_breakdown_table()`.

**React hygiene:**
- New `/app/frontend/src/lib/logger.js` — dev-only `debug/info/warn/error`, strips to no-op in production (`NODE_ENV === 'development'`).
- Replaced all 4 `console.debug(...)` calls (Dashboard, Referrals, Will, Portfolio, Advisor) with the logger.
- Converted `WitnessSign.jsx` IIFE-in-`useEffect` to `useCallback` + `useEffect(load, [load])` pattern.
- Stable keys in `Pricing.jsx`, `LawyerReview.jsx` (2 spots).
- Moved recharts chart config objects (`CHART_LEFT_MARGIN`, `SCORE_DOMAIN`, `TOOLTIP_CURSOR`, `BAR_RADIUS`) to module scope in `Compare.jsx` and `SharedReport.jsx` — kills a class of unnecessary re-renders.

**Component splits (deferred from previous reviews):**
- `Will.jsx` 666 → **556** lines (16% shrink). New `/app/frontend/src/components/will/BrowseLawyersModal.jsx` (150L) — owns lawyer fetch + Razorpay checkout orchestration. Uses idiomatic `useEffect` with `cancelled` guard per testing agent's review note.
- `Tenants.jsx` 490 → **397** lines (19% shrink). New `/app/frontend/src/components/tenants/AadhaarModal.jsx` (130L) — owns OTP step machine.

**API surface:**
- `UserOut` / `GET /api/auth/me` now exposes `referral_code` (previously referral-reward flow was opaque to API clients — flagged by iteration_15 testing).

**Tests:** iteration_15.json — 13/13 backend, 7/7 frontend smoke. Zero regressions. One skipped referral-reward test now retestable with new `referral_code` surfaced on `/auth/me`.

## Backlog / Next (P2)
- Continue frontend splits deferred: `Properties.jsx` (798L), `Portfolio.jsx` (516L) still flagged by reviewer. Next targets: `Advisor` (cyclomatic 25), `AppShell` (22), `Admin` (17).
- Split `server.py` (~5245 lines) into domain routers (lawyers.py / will.py / billing.py / admin.py / market.py / calc.py / portfolio.py).
- Expand Python type hint coverage (currently ~10%) — prioritise public API signatures.
- Swap Resend / Twilio / UIDAI Aadhaar mocks for real providers when API keys supplied.
- Admin cleanup endpoint to bulk-delete throwaway `TEST_*` accounts from seed runs.

