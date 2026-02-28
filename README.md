# AtlasPayments

Level-1 payments gateway sandbox built with Next.js App Router and TypeScript.

## Status
- Current milestone: Task 6 (payment intent create)
- Source of truth for implementation/process rules: `AGENTS.md`

## Tech Stack
- Next.js (App Router)
- TypeScript
- Prisma
- Zod
- Upstash Redis

## Prerequisites
- Node.js 20+
- pnpm 10+

## Quick Start
1. Install dependencies:
	- `pnpm install`
2. Copy environment template:
	- `cp .env.example .env.local` (or PowerShell: `Copy-Item .env.example .env.local`)
3. Start local dev server:
	- `pnpm dev`
4. Run tests:
	- `pnpm test`

## Available Scripts
- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm test`
- `pnpm test:watch`
- `pnpm prisma:generate`
- `pnpm prisma:migrate:dev -- --name <migration_name>`
- `pnpm prisma:migrate:deploy`
- `pnpm format`
- `pnpm format:check`

## API (current)
- `GET /api/health`
- `GET /api/v1/me` (Bearer API key required)
- `POST /api/v1/customers` (Bearer API key required)
- `GET /api/v1/customers` (Bearer API key required, pagination)
- `GET /api/v1/customers/{id}` (Bearer API key required)
- `POST /api/v1/payment_intents` (Bearer API key + Idempotency-Key required)

## Environment Variables (placeholders)
Create `.env.local` and set:

- `DATABASE_URL=`
- `REDIS_REST_URL=`
- `REDIS_REST_TOKEN=`
- `APP_BASE_URL=`
- `CRON_SECRET=`
- `RATE_LIMIT_MAX_REQUESTS=60`
- `RATE_LIMIT_WINDOW_SECONDS=60`
- `IDEMPOTENCY_TTL_SECONDS=86400`

## API Artifacts
- OpenAPI: `openapi.yaml`
- Postman: `postman/AtlasPayments.postman_collection.json`

## CI
GitHub Actions workflow runs:
- `pnpm install`
- `pnpm test`
