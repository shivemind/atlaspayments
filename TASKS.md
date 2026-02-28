# AtlasPayments Task Checklist

- [x] TASK 0 — Repo bootstrap (foundation)
  - [x] Next.js app (TypeScript) with App Router, ESLint, Prettier
  - [x] `pnpm` works; add `GET /api/health`
  - [x] README outline with run instructions and env placeholders
  - [x] Add `AGENTS.md` with Level-1 source-of-truth rules
  - [x] Add `TASKS.md` checklist
  - [x] CI workflow for `pnpm install` + `pnpm test`

- [x] TASK 1 — Database schema + Prisma
  - [x] Prisma schema and first migration for required Level-1 tables
  - [x] Seed-safe IDs (`cuid()`)
  - [x] Basic indexes for `merchant_id + created_at` on core tables
  - [x] Test: Prisma client connects and runs trivial query

- [x] TASK 2 — Auth middleware + API keys
  - [x] Authorization bearer key parsing helper
  - [x] API key ownership with scopes + role (`MERCHANT`, `PLATFORM_ADMIN`)
  - [x] `GET /api/v1/me` returns merchant + key metadata
  - [x] API-key fixed-window rate limiting using Upstash Redis client
  - [x] Tests: auth required, invalid key, rate limit triggered

- [x] TASK 3 — Idempotency framework (global)
  - [x] `Idempotency-Key` support for POST requests via reusable helper
  - [x] Keyed by merchant + route + request fingerprint + idempotency key
  - [x] Persist response status/body and replay exact response
  - [x] Redis cache support with Prisma persistence fallback
  - [x] Tests for replay and conflicting payload behavior

- [x] TASK 4 — Customers APIs
  - [x] `POST /api/v1/customers` with Zod validation
  - [x] `GET /api/v1/customers` with pagination
  - [x] `GET /api/v1/customers/{id}`
  - [x] Multi-tenant isolation on merchant-scoped customer access
  - [x] Tests: create + fetch + list + tenant isolation

## Next Level-1 tasks
- [ ] Populate remaining Level-1 queue from product prompt