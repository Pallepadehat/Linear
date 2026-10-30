# AGENTS.md

Guide for AI coding agents (and humans) working in this repo. Read this before making changes.

## Docs map

| Doc                                            | Use it for                                                     |
| ---------------------------------------------- | -------------------------------------------------------------- |
| [`docs/README.md`](docs/README.md)             | Index of all docs and which one wins when they disagree        |
| [`docs/prd.md`](docs/prd.md)                   | Scope (P0/P1/P2), requirements, acceptance tests, tech details |
| [`docs/domain.md`](docs/domain.md)             | Exact business rules: identifiers, statuses, PR linking, automation, roles |
| [`docs/design.md`](docs/design.md)             | Every visual decision, light + dark tokens                     |
| [`docs/roadmap.md`](docs/roadmap.md)           | What to work on next (task IDs, dependencies, status)          |
| [`docs/workflow.md`](docs/workflow.md)         | Pick → plan → build → verify → document → ship                 |
| [`docs/testing.md`](docs/testing.md)           | Test layers, rules, commands                                   |
| [`docs/decisions/`](docs/decisions/)           | ADRs: why the stack is what it is                              |

Claude Code commands: `/next-task`, `/verify`, `/finish-task` (in `.claude/commands/`).

## Project

A Linear-inspired issue tracker. Core differentiator: GitHub PRs that reference an issue identifier (e.g. `TIP-200`) are linked automatically, and PR open/merge events move the issue to In Progress / Done (PRD FR-10 – FR-13).

## Stack

| Layer    | Tech                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Monorepo | Turborepo, Bun workspaces                                                                            |
| App      | Vite, Vue 3 (`<script setup lang="ts">`), vue-router, shadcn-vue, Tailwind v4, TanStack Query, Pinia |
| API      | Fastify, oRPC (contract-first), Better Auth, Zod                                                     |
| Worker   | BullMQ on Redis                                                                                      |
| Data     | PostgreSQL + Drizzle ORM, MinIO (S3-compatible)                                                      |
| Tests    | Vitest, Playwright (E2E)                                                                             |

## Layout

```
apps/app        Vue 3 SPA — UI only, talks to the API via oRPC + Better Auth client
apps/api        Fastify server — auth, authorization, oRPC routers, GitHub webhook receiver
apps/worker     BullMQ workers — GitHub automation, image processing, cleanup
packages/contract  oRPC contract + Zod schemas (shared by app and api)
packages/db        Drizzle schema, migrations, seed
packages/core      Domain services used by api and worker
packages/queue     Queue names, job payload schemas, Redis connection
packages/storage   MinIO/S3 client and presign helpers
packages/env       Zod-validated env per app
packages/tsconfig  Shared tsconfig bases
```

Allowed imports:

```
app    → contract   (vite.config.ts may also use @linear/env/app)
api    → contract, core, db, queue, storage, env
worker → core, db, queue, storage, env
core   → db
```

`apps/app` must never import `db`, `core`, `queue`, `storage`, or anything server-only.

Detailed folder structures for each app are in PRD §8.4 – §8.6. Follow them; don't invent new top-level folders.

Workspace packages are named `@linear/<folder>` (`@linear/app`, `@linear/api`, `@linear/contract`, …).

## Commands

Run from the repo root.

```bash
docker compose up -d      # Postgres, Redis, MinIO
bun install
bun run dev               # app + api + worker (turbo)
bun run build
bun run lint
bun run typecheck
bun run test
bun run db:generate       # drizzle-kit generate after schema changes
bun run db:migrate
bun run db:seed           # demo workspace "Tip", team "TIP"
bun run db:seed:issues -- 1200   # bulk demo issues in TIP (list performance checks)
```

Scope to one package with `bun run --filter <name> <script>` or `turbo run <task> --filter=<name>`.

Ports: app 5173, api 3000, Postgres 5432, Redis 6379, S3 storage 9000 (console 9001; RustFS locally, see ADR 0008). Docker host ports can be overridden in `.env` (`POSTGRES_PORT`, `REDIS_PORT`, `STORAGE_PORT`, `STORAGE_CONSOLE_PORT`); update the URLs to match.

Demo login after `bun run db:seed`: `demo@tip.dev` / `password123` → `/tip`.

## Working on a task

Follow [`docs/workflow.md`](docs/workflow.md): pick a ready task from `docs/roadmap.md`, read the relevant PRD + `domain.md`, plan, build, verify, then update the roadmap and docs. Ambiguity: choose the simplest interpretation consistent with the docs, record it in `domain.md`, and ask only for hard-to-reverse choices (schema, contract, security).

## How to add a feature (end to end)

1. **Schema** — add/modify tables in `packages/db/src/schema/*`, run `bun run db:generate`, commit the migration. Never edit an applied migration.
2. **Contract** — add the procedure to `packages/contract` with Zod `input` and `output`. Reuse schemas; export inferred types.
3. **Domain** — put business logic in `packages/core/src/<module>/`. Functions take `db` (or a transaction) as a parameter.
4. **API** — implement the contract in `apps/api/src/modules/<module>/<module>.router.ts`. Keep routers thin; use `requireAuth` / `requireWorkspace` middleware.
5. **Jobs** (if slow or retryable) — define payload schema in `packages/queue`, enqueue from the API, handle in `apps/worker/src/jobs/`.
6. **App** — add query/mutation options in `features/<module>/queries.ts`, components in `features/<module>/components`, pages in `features/<module>/pages`, route in `router/routes.ts`.
7. **Tests** — unit tests for core logic; API integration test for the procedure.

## Rules

### Security (non-negotiable)

- Every workspace-owned query filters by `workspaceId`, and every workspace procedure uses `requireWorkspace`. Cross-workspace access is a critical bug (PRD Test 9).
- Owner-only actions (workspace settings, members, GitHub integration) check the role on the server — never only in the UI.
- GitHub webhooks: verify HMAC-SHA256 on the raw body before anything else; reject with 401.
- Secrets only via env (`packages/env`). Never log tokens, passwords, or webhook secrets. Only `VITE_*` vars reach the browser.
- Uploads: validate type and size before presigning; bucket is private; reads use short-lived presigned GET URLs after a membership check.

### API / backend

- Contract-first: change `packages/contract` first, then implement. Don't define ad-hoc Fastify routes for app data — the only non-oRPC routes are `/api/auth/*`, `/webhooks/github`, and `/health`.
- Return `NOT_FOUND` (not `FORBIDDEN`) for resources in workspaces the user isn't a member of, so IDs can't be probed.
- Contract outputs are explicit DTOs — never `z.any()`, never raw DB rows (no password hashes, tokens, or secrets).
- `buildApp()` has no side effects at import time (no listening, no eager connections) so tests can build it.
- Throw typed `ORPCError`s (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`). Don't leak internal errors.
- Issue numbers are allocated atomically in the create transaction (`issue_counter + 1 RETURNING`). Never compute `max(number) + 1`.
- List procedures over unbounded data (issues, comments, activity) use cursor pagination. Small bounded lists (a user's workspaces, teams, members, statuses) return plain arrays.
- Request handlers must stay fast. Webhook processing, image processing, and cleanup go to BullMQ.
- Use Drizzle's query builder; no raw SQL string concatenation.
- Map expected failures in `packages/core` to `DomainError(code)`; the oRPC base middleware turns them into typed errors and logs anything unexpected.
- Name composite unique constraints explicitly in snake_case (`unique('teams_workspace_id_key_unique')`) so `isUniqueViolation` can match them.
- DB naming: tables `snake_case` plural, TS `camelCase`; every table has `id` (UUIDv7), `createdAt`, `updatedAt`. Express invariants as DB constraints. Never edit an applied migration.

### Worker / jobs

- Jobs are idempotent. GitHub jobs use the delivery ID as `jobId`.
- Payloads carry IDs, not full records; validate with the schema from `packages/queue`.
- Automation rules (PRD FR-12) are pure functions in `packages/core/src/automation` and must have unit tests for every rule (A–F).
- Reconcile against current PR state; never let an out-of-order event regress a merged PR.
- A PR closed without merge never completes an issue.

### Frontend

- Server state lives in TanStack Query only. Pinia is for UI state (sidebar, command menu, preferences).
- Use the oRPC query utils for keys and options (`orpc.issues.list.queryOptions(...)`). No hand-written query keys, no raw `fetch`.
- All routes are lazy-loaded. Heavy components use `defineAsyncComponent`.
- Issue property changes and board moves are optimistic with rollback.
- Virtualize long lists (`@tanstack/vue-virtual`).
- `components/ui/` is owned by the shadcn-vue CLI (`bunx shadcn-vue@latest add <component>`). Customize via variants/tokens; put composites in `components/common/` or the feature folder.
- Forms: vee-validate + the Zod schema from `packages/contract`.
- Naming: `PascalCase.vue`, pages end in `Page.vue`, composables `useX.ts`, other files `kebab-case.ts`.
- Accessibility: keyboard reachable, visible focus ring, labelled inputs.

### Design

- The app must look like Linear's own product UI, in light and dark. Follow "Product UI (App)" in `docs/design.md` (it wins over the marketing-derived rules) and compare side by side with Linear before calling UI done.
- Use tokens from `docs/design.md` via Tailwind theme classes (`bg-surface-1`, `border-hairline`, `text-ink-subtle`, …). No hard-coded hex values in components.
- Dark and light themes are both first-class. Tokens are CSS variables (`:root` = light, `.dark` = dark); see "Themes (App)" in `docs/design.md`. Never use `dark:` overrides with raw colors — use tokens so both themes come for free.
- Dark canvas `#010102` (never `#000000`); light canvas `#fcfcfd` (never pure `#ffffff`).
- Check every new or changed UI in both themes.
- Lavender `primary` (#5e6ad2) only for primary actions, focus rings, brand mark, link emphasis, and the in-app uses in `docs/design.md` → "Product UI (App)" (e.g. the Done status icon) — never as a fill for sections or cards.
- Status, priority and label colors come from the semantic tokens (`status-*`, `priority-urgent`, label color); no other chromatic colors.
- Hierarchy through the surface ladder + 1px hairlines, not shadows. Menus and popovers use the `floating` surface.
- Radii: buttons, property chips and status pills `rounded-full` (icon-only buttons are circles); inputs and sidebar/list rows `rounded-md` (8px); cards, popovers and panels `rounded-lg` (12px); dialogs `rounded-xl` (16px); badges `rounded-xs` (4px); avatars `rounded-full`.
- Fonts: Inter (UI), JetBrains Mono (issue identifiers, code).
- Dense, compact layouts: 4px spacing base, 13px body in the app UI, 28px controls (`size="sm"`), 36px list rows (see "Density" in `docs/design.md`).

### TypeScript & code style

- `strict` on everywhere. No `any`; prefer `unknown` + narrowing. Infer types from Zod/Drizzle rather than duplicating them.
- Prefer named exports. One component per file.
- Match the surrounding code's style and comment density. Comments explain _why_, not _what_.
- Don't add dependencies without a clear need; add them to the specific workspace, not the root.

## Testing

Details in [`docs/testing.md`](docs/testing.md).

- Unit: `packages/core` (identifier allocation, automation rules, PR identifier parsing).
- Integration: API procedures against a real Postgres (Docker), including authorization failures.
- The 10 acceptance tests in PRD §12 must stay green; add a test when you touch the related behavior.
- Run `bun run lint && bun run typecheck && bun run test` before finishing a task.

## Definition of done for a change

- Builds, lints, typechecks, and tests pass.
- Migration committed if the schema changed.
- Contract, API, and app types line up (no casts to silence errors).
- Workspace scoping and role checks in place for new procedures.
- UI follows `docs/design.md` and looks right in both light and dark.
- `.env.example` updated if new env vars were added.
- Roadmap task marked `[x]` with a log line; `domain.md` / ADRs updated if rules or decisions changed.
- PR targets `develop` (production is `main`; see branch rules in `docs/workflow.md`) and references its Linear issue (`Fixes LIN-<n>`; see "Linear" in `docs/workflow.md`).
- Commits follow Conventional Commits (`feat(api): …`); no AI attribution or co-author trailers.

## Don'ts

- Don't access the database, Redis, or MinIO from `apps/app`.
- Don't put business logic in Vue components or oRPC routers — use `packages/core`.
- Don't do slow work (GitHub API calls, image processing) in the request path.
- Don't implement P2 features (PRD §3.3) unless asked.
- Don't copy Linear's proprietary assets or fonts.
