# Testing

## Layers

| Layer       | Tool        | Location                                   | What                                                         |
| ----------- | ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| Unit        | Vitest      | `packages/*/src/**/*.test.ts`              | Pure logic: identifier parsing, automation rules, validators |
| Integration | Vitest      | `apps/api/test/**/*.test.ts`               | oRPC procedures + webhook route against real Postgres/Redis  |
| Worker      | Vitest      | `apps/worker/test/**/*.test.ts`            | Job handlers called directly with a real DB                  |
| Component   | Vitest + @vue/test-utils | `apps/app/src/**/*.test.ts`   | Only for components with real logic (pickers, filters)       |
| E2E         | Playwright  | `apps/app/e2e/`                            | Critical flows: sign up → workspace → issue; demo scenario   |

## Rules

- No mocking the database. Integration tests run against the Docker Postgres using a separate database (`linear_test`), migrated once per run; each test file truncates the tables it uses.
- Mock only external services: GitHub (Octokit calls, via fixtures in `apps/*/test/fixtures/github/`) and, where needed, S3.
- Webhook tests send real fixture payloads signed with the test secret.
- Every oRPC procedure gets at least: happy path, unauthenticated → `UNAUTHORIZED`, other workspace → `FORBIDDEN`/`NOT_FOUND`.
- Every automation rule (A–F in `domain.md`) has a unit test; Tests 1–9 of PRD §12 exist as integration tests named `acceptance: <n> <title>`.
- Concurrency: issue creation has a test that creates ~20 issues in parallel and asserts unique, gap-free numbers.
- Tests are deterministic: no real time (`vi.useFakeTimers` or injected clock), no network.

## Commands

```bash
bun run test                          # all (packages run one at a time: DB suites share linear_test)
bun run --filter @linear/core test    # one package
bun run test -- --watch               # watch mode
bun run test:e2e                      # Playwright (needs dev stack running)
```

For Podman installations, the same infrastructure runs with `podman compose up -d postgres redis`.
Set `DATABASE_URL` (or `TEST_DATABASE_URL`) and `REDIS_URL` to the published host ports,
either in the root `.env` or the command environment. With the default local credentials:

```bash
DATABASE_URL=postgres://linear:linear@localhost:5432/linear bun run test
```

Tests need access to the local PostgreSQL and Redis services. In a restricted agent sandbox,
run the checks with local service access enabled. The Vite source-map error
`code.charCodeAt is not a function` can mask a global-setup failure: check database
configuration and connectivity before changing test dependencies.

## Test data

API tests use `setupTestApp()` / `signUp()` / `rpcClient()` from `apps/api/test/harness.ts`: the real app via `app.inject()`, Redis queues under a `test` prefix, and the in-memory storage from `@linear/storage/testing`.

Factories live in `packages/db/src/testing/` (`createUser`, `createWorkspace`, `createTeam`, `createIssue`, …) and return inserted rows. Prefer factories over hand-written inserts.
