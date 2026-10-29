# Roadmap

Task breakdown of PRD §11. Work top to bottom inside a milestone; a task is ready when all its dependencies are `[x]`.

**Status:** `[ ]` todo · `[~]` in progress · `[x]` done
**How to use:** mark a task `[~]` when you start it and `[x]` when it meets the [definition of done](../AGENTS.md#definition-of-done-for-a-change). Add new tasks with the next free ID; never renumber.

## M1 — Foundation

| ID     | Status | Task                                                                                   | Depends on   |
| ------ | ------ | -------------------------------------------------------------------------------------- | ------------ |
| M1-01  | [ ]    | Turborepo + Bun workspaces, root scripts, `turbo.json`, `packages/tsconfig`            | —            |
| M1-02  | [ ]    | ESLint (flat) + Prettier shared config, `lint` / `typecheck` / `format` tasks           | M1-01        |
| M1-03  | [ ]    | `docker-compose.yml`: Postgres 16, Redis 7, MinIO + bucket init; `.env.example`         | M1-01        |
| M1-04  | [ ]    | `packages/env`: Zod env loaders for api, worker, app                                    | M1-01        |
| M1-05  | [ ]    | `packages/db`: Drizzle client, drizzle-kit config, `db:*` scripts, first migration      | M1-03, M1-04 |
| M1-06  | [ ]    | `apps/api`: Fastify `buildApp()`, CORS, pino, `/health`                                 | M1-04        |
| M1-07  | [ ]    | Better Auth: Drizzle adapter, auth tables, mounted at `/api/auth/*`                     | M1-05, M1-06 |
| M1-08  | [ ]    | `packages/contract` + oRPC mounted at `/rpc/*`, context, `requireAuth`, `me.get`        | M1-07        |
| M1-09  | [ ]    | `apps/app`: Vite + Vue 3 + vue-router + Tailwind v4 + shadcn-vue init, dev proxy        | M1-01        |
| M1-10  | [ ]    | Design tokens in `globals.css` (light + dark), Inter / JetBrains Mono, `useTheme`, no-flash script | M1-09 |
| M1-11  | [ ]    | oRPC client + TanStack Query + Better Auth client in app                                | M1-08, M1-09 |
| M1-12  | [ ]    | Auth pages (login, register), route guards, `AuthLayout`                               | M1-10, M1-11 |
| M1-13  | [ ]    | Schema + procedures: workspaces, members, teams (+ default statuses)                    | M1-08        |
| M1-14  | [ ]    | Workspace setup flow (create workspace + first team), `WorkspaceLayout` with sidebar    | M1-12, M1-13 |
| M1-15  | [ ]    | `packages/queue` + `apps/worker` skeleton with graceful shutdown                        | M1-03, M1-04 |
| M1-16  | [ ]    | `packages/storage` + uploads procedures + `media` job; avatar upload end to end         | M1-13, M1-15 |
| M1-17  | [ ]    | Vitest setup for packages + API integration test harness (test DB)                      | M1-05, M1-06 |
| M1-18  | [ ]    | Seed script: demo user, workspace `Tip`, team `TIP`                                     | M1-13        |

## M2 — Issue management

| ID     | Status | Task                                                                    | Depends on |
| ------ | ------ | ----------------------------------------------------------------------- | ---------- |
| M2-01  | [ ]    | Issue schema + atomic identifier allocation (+ concurrency test)        | M1-13      |
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
| M4-01  | [ ]    | GitHub schema: installations, repos, PRs, issue-PR links, webhook deliveries  | M2-01      |
| M4-02  | [ ]    | Identifier parser (branch/title/body, link types) + unit tests                | —          |
| M4-03  | [ ]    | Automation rules `evaluate()` + unit tests for rules A–F                      | —          |
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
