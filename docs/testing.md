# Testing

## Layers

| Layer       | Tool        | Location                                   | What                                                         |
| ----------- | ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| Unit        | Vitest      | `packages/*/src/**/*.test.ts`              | Pure logic: identifier parsing, automation rules, validators |
| Integration | Vitest      | `apps/api/test/**/*.test.ts`               | oRPC procedures + webhook route against real Postgres/Redis  |
| Worker      | Vitest      | `apps/worker/test/**/*.test.ts`            | Job handlers called directly with a real DB                  |
| Component   | Vitest + @vue/test-utils | `apps/app/src/**/*.test.ts`   | Only for components with real logic (pickers, filters)       |
| E2E         | Playwright  | `apps/app/e2e/`                            | The demo scenario (PRD §12 Test 10) and browser security checks |
| Security    | Vitest      | `apps/api/test/security/`                  | Auth, access control, injection/XSS, hashing, headers, TLS cookies |
| Boundaries  | Vitest      | `packages/contract/src/schemas/boundaries.test.ts` | Every input limit just below, on and above the edge  |
| Load        | Bun script  | `apps/api/perf/load-test.ts`               | 1 → 20 concurrent users: latency, errors, CPU/RAM (SLO gate) |
| DAST / SAST | OWASP ZAP, CodeQL, `bun audit` | `.github/workflows/security.yml` | Scan of the production stack, static analysis, known CVEs |

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
| 10 End-to-end demonstration | `apps/app/e2e/demo.spec.ts` (Playwright, see [E2E](#e2e-playwright)) | Tests 3–5 |

`apps/worker/test/github-webhook.test.ts` also covers the same scenarios at the job level, plus out-of-order events, edits and rule F.

```bash
bun run --filter @linear/api test -- test/acceptance   # only the acceptance tests
```

## Commands

```bash
bun run test                          # all (packages run one at a time: DB suites share linear_test)
bun run --filter @linear/core test    # one package
bun run test -- --watch               # watch mode
bun run test:e2e                      # Playwright; starts its own stack (see E2E below)
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

## E2E (Playwright)

`apps/app/e2e/demo.spec.ts` is PRD §12 Test 10 in headless Chromium: log in as `demo@tip.dev`, create "Fix login validation" in TIP, then send a signed `pull_request.opened` (branch `tip-<n>-fix-login`) and a merged `pull_request.closed` to the real `/webhooks/github`. The open issue page must show **In Progress** / PR **Open**, then **Done** / **Merged**, without a reload (realtime).

- `e2e/stack.ts` is Playwright's `webServer`. It drops and re-creates the `linear_e2e` database, runs `db:migrate`, `db:seed` and `demo:github connect`, then starts the api, the worker and Vite. Stopping the run stops all three.
- It is isolated from a dev stack: api on `3100`, app on `5180`, Redis logical DB `1`, its own database, a test-only webhook secret, and the GitHub App disabled. Override with `E2E_API_PORT`, `E2E_APP_PORT`, `E2E_DATABASE_URL` (name must contain `e2e`), `E2E_REDIS_URL`; `E2E_LOG_LEVEL` (default `warn`) controls api/worker logs.
- Postgres and Redis come from `DATABASE_URL` / `REDIS_URL` (env or root `.env`). If Postgres refuses connections locally, it runs `docker compose up -d --wait postgres redis` first. Object storage isn't needed.
- `e2e/github.ts` signs payloads from `apps/api/test/fixtures/github/`, retargeted at the demo repository.
- Traces and screenshots are kept for failed tests (`apps/app/test-results/`, open with `bunx playwright show-trace`). CI runs it in the `e2e` job and uploads the report and traces on failure.

```bash
cd apps/app && bunx playwright install chromium   # once
bun run test:e2e
```

## Security

`apps/api/test/security/` runs with the rest of the api suite (`bun run test`):

| File | Checks |
| --- | --- |
| `authentication.test.ts` | Same 401 for wrong password and unknown email, password length boundaries, SQL injection in the login form, HttpOnly/SameSite session cookie, forged cookies, CSRF (untrusted Origin → 403), sign-out ends the session |
| `password-hashing.test.ts` | Stored hash is salted scrypt (never the password or its MD5), unique salts, MD5 vs scrypt speed, an Argon2id example |
| `access-control.test.ts` | Anonymous / stranger / member / owner matrix, IDOR on issue ids, no secrets in DTOs |
| `injection.test.ts` | SQL payloads in search and filters, payload titles stored verbatim, slug/uuid validation, XSS payloads returned as JSON text, no HTML/SVG uploads |
| `security-headers.test.ts` | Hardening headers on every response, HSTS only over HTTPS, `__Secure-` Secure cookies when the app runs on https |

Better Auth turns its Origin/CSRF check off when it detects a test run; `apps/api/src/auth/auth.ts` pins it on so these tests see what production does.

`apps/app/e2e/security.spec.ts` covers the browser side: login redirect, wrong password, HttpOnly cookie (`document.cookie`), open redirect, and a stored-XSS title that must render as text.

`.github/workflows/security.yml` adds `bun audit` (high/critical fail; accepted advisories are listed with a reason), CodeQL, and an OWASP ZAP baseline scan of the production stack. `.zap/rules.tsv` makes regressions of fixed findings (missing headers, leaked server version, cookie flags) fail the job and keeps accepted risks visible as warnings. Locally (Docker Desktop/OrbStack: the scanner reaches the host as `host.docker.internal`):

```bash
docker compose -f docker-compose.prod.yml up -d --build --wait
mkdir -p zap && cp .zap/rules.tsv zap/ && chmod -R 777 zap
docker run --rm -v "$PWD/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://host.docker.internal:8080 -c rules.tsv -I -r report.html
```

HTTPS: `docker-compose.tls.yml` puts Caddy (local CA) in front of the production stack; see the commands at the top of that file.

## Load test

`bun run --filter @linear/api perf` creates a fresh `linear_perf` database (seed + 1200 issues), starts the api in production mode on port 3200, and runs virtual users that each loop: `me.get`, `issues.list`, a search, `issues.getByIdentifier`, and every fifth round `issues.create`. Stages ramp 1 → 5 → 10 → 20 users, 20 s each, after a 3 s warm-up. It prints a Markdown table (also `apps/api/perf/results/latest.md` and the CI job summary) and exits 1 unless p95 < 500 ms and errors < 1 % at the last stage.

Options: `PERF_STAGES=1,5,10,20,50`, `PERF_STAGE_SECONDS`, `PERF_ISSUES`, `PERF_SLO_P95_MS`, `PERF_API_PORT`, and `PERF_DOCKER_CONTAINER=<postgres container>` to add database CPU/RAM. CPU is % of one core, sampled every second with `ps` (api) and `docker stats` (database). The `perf` job in `ci.yml` runs it on every push and PR.

## Test data

API tests use `setupTestApp()` / `signUp()` / `rpcClient()` from `apps/api/test/harness.ts`: the real app via `app.inject()`, Redis queues under a `test` prefix, and the in-memory storage from `@linear/storage/testing`.

Factories live in `packages/db/src/testing/` (`createUser`, `createWorkspace`, `createTeam`, `createIssue`, …) and return inserted rows. Prefer factories over hand-written inserts.
