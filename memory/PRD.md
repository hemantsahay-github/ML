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
