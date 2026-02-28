# AtlasPayments — AGENTS Source of Truth (Level 1)

## Scope Guardrail
- Build only Level-1 payments gateway sandbox capabilities.
- Do not start features beyond Level 1.
- Keep implementation deployable on Vercel (no separate worker process).
- Background processing must be implemented via internal cron endpoints.

## Required Stack
- TypeScript
- Next.js App Router route handlers
- Prisma
- Zod
- Upstash Redis

## Development Workflow (mandatory per task)
For each task or PR-sized change:
1. Implement the task.
2. Add/adjust tests.
3. Update `openapi.yaml` examples when endpoint behavior changes.
4. Update Postman collection when endpoint behavior changes.
5. Ensure `pnpm test` passes.

## Repository Hygiene
- Keep commits and PRs small and cohesive.
- Prefer TODO markers over sprawling partial features.
- Do not couple independent features in one task.

## Deterministic Mock Processor Rules (Level 1)
- Responses must be deterministic for identical inputs.
- If request amount is divisible by 10, return approved.
- If request amount is divisible by 5 (but not by 10), return declined.
- All other amounts return pending.
- Use a stable idempotency key strategy to avoid duplicate side effects.
- Persist deterministic outcomes so retries return the original result.

## API Artifacts
- OpenAPI document lives at `openapi.yaml`.
- Postman collection lives at `postman/AtlasPayments.postman_collection.json`.
- Keep examples synchronized with current route behavior.

## Testing Expectations
- Every endpoint change must include or update tests.
- Tests should cover deterministic outcomes and edge conditions relevant to the task.
- `pnpm test` is the acceptance gate for code changes.

## Deployment Constraints
- Must remain compatible with Vercel deployment.
- Avoid architecture requiring always-on jobs or separate workers.