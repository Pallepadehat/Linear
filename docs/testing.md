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
- Every automation rule (A–F in `domain.md`) has a unit test; Tests 1–9 of PRD §12 exist as integration tests named `acceptance: <n> <title>` (see [Acceptance tests](#acceptance-tests-prd-12)).
- Concurrency: issue creation has a test that creates ~20 issues in parallel and asserts unique, gap-free numbers.
- Tests are deterministic: no real time (`vi.useFakeTimers` or injected clock), no network.

## Acceptance tests (PRD §12)

One file per test in `apps/api/test/acceptance/`. Tests 3–9 drive the real path: a fixture payload from `apps/api/test/fixtures/github/` is signed and posted to `/webhooks/github`, the route stores and enqueues it, and the real GitHub worker (`createGithubWorker` from `@linear/worker/testing`, on the same `test` queue prefix) processes it before the test asserts on the database. Helpers live in `apps/api/test/acceptance/github.ts`.

| PRD test | File | Related coverage |
| --- | --- | --- |
| 1 Issue creation | `01-issue-creation.test.ts` | `apps/api/test/issues.test.ts` → `createIssue` (concurrency, no reuse) |
| 2 Issue editing | `02-issue-editing.test.ts` | `apps/api/test/issues.test.ts` → `issues procedures` |
| 3 GitHub linking | `03-github-linking.test.ts` | `packages/core/src/github/parse-identifiers.test.ts` |
| 4 Automatic In Progress | `04-automatic-in-progress.test.ts` | `packages/core/src/automation/evaluate.test.ts` (rule A) |
| 5 Automatic completion | `05-automatic-completion.test.ts` | `evaluate.test.ts` (rule B) |
| 6 Closed without merge | `06-closed-without-merge.test.ts` | `evaluate.test.ts` (rule C) |
| 7 Multiple PRs | `07-multiple-prs.test.ts` | `evaluate.test.ts` (multi-PR cases) |
| 8 Duplicate webhooks | `08-duplicate-webhooks.test.ts` | `apps/api/test/github-webhook.test.ts` (concurrent duplicates) |
| 9 Cross-workspace protection | `09-cross-workspace-protection.test.ts` | `apps/worker/test/github-webhook.test.ts` |

`apps/worker/test/github-webhook.test.ts` also covers the same scenarios at the job level, plus out-of-order events, edits and rule F.

```bash
bun run --filter @linear/api test -- test/acceptance   # only the acceptance tests
```

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
