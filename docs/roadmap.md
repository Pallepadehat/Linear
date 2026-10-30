# Roadmap

Task breakdown of PRD §11. Work top to bottom inside a milestone; a task is ready when all its dependencies are `[x]`.

**Status:** `[ ]` todo · `[~]` in progress · `[x]` done
**How to use:** mark a task `[~]` when you start it and `[x]` when it meets the [definition of done](../AGENTS.md#definition-of-done-for-a-change). Add new tasks with the next free ID; never renumber.

## M1 — Foundation

| ID     | Status | Task                                                                                   | Depends on   |
| ------ | ------ | -------------------------------------------------------------------------------------- | ------------ |
| M1-01  | [x]    | Turborepo + Bun workspaces, root scripts, `turbo.json`, `packages/tsconfig`            | —            |
| M1-02  | [x]    | ESLint (flat) + Prettier shared config, `lint` / `typecheck` / `format` tasks           | M1-01        |
| M1-03  | [x]    | `docker-compose.yml`: Postgres 16, Redis 7, MinIO + bucket init; `.env.example`         | M1-01        |
| M1-04  | [x]    | `packages/env`: Zod env loaders for api, worker, app                                    | M1-01        |
| M1-05  | [x]    | `packages/db`: Drizzle client, drizzle-kit config, `db:*` scripts, first migration      | M1-03, M1-04 |
| M1-06  | [x]    | `apps/api`: Fastify `buildApp()`, CORS, pino, `/health`                                 | M1-04        |
| M1-07  | [x]    | Better Auth: Drizzle adapter, auth tables, mounted at `/api/auth/*`                     | M1-05, M1-06 |
| M1-08  | [x]    | `packages/contract` + oRPC mounted at `/rpc/*`, context, `requireAuth`, `me.get`        | M1-07        |
| M1-09  | [x]    | `apps/app`: Vite + Vue 3 + vue-router + Tailwind v4 + shadcn-vue init, dev proxy        | M1-01        |
| M1-10  | [x]    | Design tokens in `globals.css` (light + dark), Inter / JetBrains Mono, `useTheme`, no-flash script | M1-09 |
| M1-11  | [x]    | oRPC client + TanStack Query + Better Auth client in app                                | M1-08, M1-09 |
| M1-12  | [x]    | Auth pages (login, register), route guards, `AuthLayout`                               | M1-10, M1-11 |
| M1-13  | [x]    | Schema + procedures: workspaces, members, teams (+ default statuses)                    | M1-08        |
| M1-14  | [x]    | Workspace setup flow (create workspace + first team), `WorkspaceLayout` with sidebar    | M1-12, M1-13 |
| M1-15  | [x]    | `packages/queue` + `apps/worker` skeleton with graceful shutdown                        | M1-03, M1-04 |
| M1-16  | [x]    | `packages/storage` + uploads procedures + `media` job; avatar upload end to end         | M1-13, M1-15 |
| M1-17  | [x]    | Vitest setup for packages + API integration test harness (test DB)                      | M1-05, M1-06 |
| M1-18  | [x]    | Seed script: demo user, workspace `Tip`, team `TIP`                                     | M1-13        |

## M2 — Issue management

| ID     | Status | Task                                                                    | Depends on |
| ------ | ------ | ----------------------------------------------------------------------- | ---------- |
| M2-01  | [x]    | Issue schema + atomic identifier allocation (+ concurrency test)        | M1-13      |
| M2-02  | [ ]    | Issue procedures: create, get, getByIdentifier, update, delete, list    | M2-01      |
| M2-03  | [ ]    | Labels schema + procedures                                              | M1-13      |
| M2-04  | [ ]    | Comments schema + procedures                                            | M2-02      |
| M2-05  | [ ]    | ActivityLog writes for issue changes                                    | M2-02      |
| M2-06  | [ ]    | Common UI: StatusIcon, PriorityIcon, UserAvatar, pickers                | M1-10      |
| M2-07  | [ ]    | Issue list (virtualized) + create issue dialog                          | M2-02, M2-06 |
| M2-08  | [ ]    | Issue detail page: properties sidebar, description, comments, activity  | M2-04, M2-05, M2-06 |
| M2-09  | [ ]    | Optimistic updates for status, priority, assignee, labels               | M2-07      |

## M3 — Projects and views

| ID     | Status | Task                                                   | Depends on |
| ------ | ------ | ------------------------------------------------------ | ---------- |
| M3-01  | [ ]    | Projects schema + procedures, project icon upload      | M2-02, M1-16 |
| M3-02  | [ ]    | Projects list + project detail pages                   | M3-01      |
| M3-03  | [ ]    | My Issues view                                         | M2-07      |
| M3-04  | [ ]    | Board view with drag-and-drop status changes           | M2-09      |
| M3-05  | [ ]    | Filters, sorting, search (title + identifier), URL-synced | M2-07   |

## M4 — GitHub integration

| ID     | Status | Task                                                                          | Depends on |
| ------ | ------ | ----------------------------------------------------------------------------- | ---------- |
| M4-01  | [~]    | GitHub schema: installations, repos, PRs, issue-PR links, webhook deliveries  | M2-01      |
| M4-02  | [ ]    | Identifier parser (branch/title/body, link types) + unit tests                | —          |
| M4-03  | [x]    | Automation rules `evaluate()` + unit tests for rules A–F                      | —          |
| M4-04  | [ ]    | Webhook route: signature check, delivery persist, enqueue                     | M4-01, M1-15 |
| M4-05  | [ ]    | Worker: process `pull_request`, link, reconcile, automate (one transaction)   | M4-02, M4-03, M4-04 |
| M4-06  | [ ]    | GitHub App install flow + connect/disconnect repos (settings UI)              | M4-01      |
| M4-07  | [ ]    | Linked PRs on issue detail                                                    | M4-05, M2-08 |

## M5 — Testing and finalization

| ID     | Status | Task                                                       | Depends on |
| ------ | ------ | ---------------------------------------------------------- | ---------- |
| M5-01  | [ ]    | PRD §12 acceptance tests 1–9 as automated tests            | M4-05      |
| M5-02  | [ ]    | Playwright E2E: demo scenario (Test 10, with mocked GitHub) | M4-07     |
| M5-03  | [ ]    | Accessibility + both-theme UI pass                         | M3-*       |
| M5-04  | [ ]    | README: setup, env, Docker, GitHub App, demo script        | M4-06      |

## P1 backlog (after P0)

Keyboard shortcuts · command menu · rich-text editor · notifications · due dates · sub-issues · project progress · issue relations · issue/comment attachments · draft/review PR indicators.

## Log

Append one line per finished task: `YYYY-MM-DD · ID · short note`.

2026-10-29 · M1-01 · Turborepo + Bun workspaces, shared tsconfig bases
2026-10-29 · M1-02 · root ESLint flat config (enforces app/core import boundaries) + Prettier; format check in CI
2026-10-29 · M1-03 · compose with Postgres 16, Redis 7, RustFS (MinIO images unavailable, ADR 0008), overridable host ports
2026-10-29 · M1-04 · Zod env loaders; root .env loaded from any package dir
2026-10-29 · M1-05 · Drizzle client, snake_case casing, 0000_init migration, migrate script
2026-10-29 · M1-06 · buildApp() with injected deps, CORS, pino with redaction, /health (DB + Redis)
2026-10-29 · M1-07 · Better Auth email/password, UUIDv7 ids, mounted at /api/auth/*
2026-10-29 · M1-08 · contract + RPCHandler at /rpc/*, requireAuth/requireWorkspace, DomainError mapping, me.get
2026-10-29 · M1-09 · Vite + Vue 3 + router + Tailwind v4 + shadcn-vue, /api and /rpc dev proxy
2026-10-29 · M1-10 · light/dark tokens mapped to shadcn vars, Inter/JetBrains Mono (self-hosted), useTheme, no-flash script
2026-10-29 · M1-11 · oRPC TanStack utils, QueryClient defaults, Better Auth Vue client
2026-10-29 · M1-12 · login/register with vee-validate (zod 4 adapter), guards, AuthLayout
2026-10-29 · M1-13 · workspaces/members/teams/statuses schema + procedures; reserved slugs
2026-10-29 · M1-14 · setup flow with slug/key suggestions, WorkspaceLayout sidebar, teams + settings pages
2026-10-29 · M1-15 · queue names/payload schemas, worker with media + maintenance, hourly cleanup, graceful shutdown
2026-10-29 · M1-16 · presign → PUT → confirm, sharp variants with metadata stripped, avatar in sidebar/members
2026-10-29 · M1-17 · Vitest per package, API inject harness on linear_test, worker job tests, CI services
2026-10-29 · M1-18 · idempotent seed: demo@tip.dev, workspace Tip, team TIP
2026-10-30 · M2-01 · issues table, createIssue allocates numbers via teams.issue_counter UPDATE … RETURNING; 20-way concurrency test
2026-10-30 · M4-03 · pure automation evaluate(), exported event/domain types, 29 tests covering A–F and multi-PR cases; full suite blocked by API/worker Vite startup error

2026-10-30 · M4-01 · GitHub tables, enums, indexes, migration and uniqueness integration tests implemented; verification pending: lint/typecheck/build pass, API/worker tests hit Vite startup error, fresh migration blocked by unavailable Postgres (ECONNREFUSED).
