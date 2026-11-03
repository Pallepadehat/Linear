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
| M2-02  | [x]    | Issue procedures: create, get, getByIdentifier, update, delete, list    | M2-01      |
| M2-03  | [x]    | Labels schema + procedures                                              | M1-13      |
| M2-04  | [x]    | Comments schema + procedures                                            | M2-02      |
| M2-05  | [x]    | ActivityLog writes for issue changes                                    | M2-02      |
| M2-06  | [x]    | Common UI: StatusIcon, PriorityIcon, UserAvatar, pickers                | M1-10      |
| M2-07  | [x]    | Issue list (virtualized) + create issue dialog                          | M2-02, M2-06 |
| M2-08  | [x]    | Issue detail page: properties sidebar, description, comments, activity  | M2-04, M2-05, M2-06 |
| M2-09  | [x]    | Optimistic updates for status, priority, assignee, labels               | M2-07      |

## M3 — Projects and views

| ID     | Status | Task                                                   | Depends on |
| ------ | ------ | ------------------------------------------------------ | ---------- |
| M3-01  | [x]    | Projects schema + procedures, project icon upload      | M2-02, M1-16 |
| M3-02  | [x]    | Projects list + project detail pages                   | M3-01      |
| M3-03  | [x]    | My Issues view                                         | M2-07      |
| M3-04  | [x]    | Board view with drag-and-drop status changes           | M2-09      |
| M3-05  | [x]    | Filters, sorting, search (title + identifier), URL-synced | M2-07   |

## M4 — GitHub integration

| ID     | Status | Task                                                                          | Depends on |
| ------ | ------ | ----------------------------------------------------------------------------- | ---------- |
| M4-01  | [x]    | GitHub schema: installations, repos, PRs, issue-PR links, webhook deliveries  | M2-01      |
| M4-02  | [x]    | Identifier parser (branch/title/body, link types) + unit tests                | —          |
| M4-03  | [x]    | Automation rules `evaluate()` + unit tests for rules A–F                      | —          |
| M4-04  | [x]    | Webhook route: signature check, delivery persist, enqueue                     | M4-01, M1-15 |
| M4-05  | [x]    | Worker: process `pull_request`, link, reconcile, automate (one transaction)   | M4-02, M4-03, M4-04 |
| M4-06  | [x]    | GitHub App install flow + connect/disconnect repos (settings UI)              | M4-01      |
| M4-07  | [x]    | Linked PRs on issue detail                                                    | M4-05, M2-08 |

## M5 — Testing and finalization

| ID     | Status | Task                                                       | Depends on |
| ------ | ------ | ---------------------------------------------------------- | ---------- |
| M5-01  | [x]    | PRD §12 acceptance tests 1–9 as automated tests            | M4-05      |
| M5-02  | [ ]    | Playwright E2E: demo scenario (Test 10, with mocked GitHub) | M4-07     |
| M5-03  | [x]    | Accessibility + both-theme UI pass                         | M3-*       |
| M5-04  | [x]    | README: setup, env, Docker, GitHub App, demo script        | M4-06      |

## M6 — Realtime

| ID     | Status | Task                                                                                   | Depends on   |
| ------ | ------ | -------------------------------------------------------------------------------------- | ------------ |
| M6-01  | [x]    | Realtime updates over WebSockets: issue/comment events via Redis pub/sub, live caches | M2-08, M3-04 |

## M7 — Issue views and app shell

| ID     | Status | Task                                                                                          | Depends on   |
| ------ | ------ | --------------------------------------------------------------------------------------------- | ------------ |
| M7-01  | [x]    | App shell: Linear sidebar sections + page header (LIN-53)                                     | —            |
| M7-02  | [ ]    | Issue view tabs: Active / Backlog / All issues (LIN-54)                                       | M7-01        |
| M7-03  | [ ]    | Display options popover: grouping, sub-grouping, ordering, completed, empty groups, properties (LIN-56) | M7-02 |
| M7-04  | [ ]    | Issue row parity: project, PR, due date, estimate chips and overflow (LIN-59)                 | M7-03, M4-07 |
| M7-05  | [ ]    | Details side panel (⌘I): breakdown by assignees / labels / priority / projects (LIN-62)       | M7-02        |
| M7-06  | [ ]    | Filter menu parity: Add filter… (F), creator, dates, content, links, operators (LIN-67)       | M7-02        |
| M7-07  | [ ]    | Issue detail header: breadcrumb, favorite, "…" menu, 1 / N prev/next navigation (LIN-72)      | —            |
| M7-08  | [ ]    | Copy actions: issue URL, identifier, git branch, Copy as prompt (LIN-76)                      | M7-07        |
| M7-09  | [ ]    | Label picker: create labels by typing, team + workspace sections, label settings (LIN-52)     | —            |
| M7-10  | [x]    | Assignee picker parity: No assignee, me first, team members, digit shortcuts (LIN-78)         | —            |
| M7-11  | [ ]    | Command menu (⌘K) + keyboard shortcuts + shortcut help (LIN-80)                               | M7-01        |
| M7-12  | [ ]    | Multi-select and bulk actions on issue list and board (LIN-82)                                | M7-11        |

## M8 — Issue planning properties

| ID     | Status | Task                                                                                   | Depends on   |
| ------ | ------ | -------------------------------------------------------------------------------------- | ------------ |
| M8-01  | [ ]    | Estimates: team estimate scale, estimate picker, sums in groups (LIN-55)               | —            |
| M8-02  | [ ]    | Due dates: due date picker (⇧D), overdue styling, filter + sort (LIN-58)               | —            |
| M8-03  | [ ]    | Sub-issues: parent/child, sub-issue list with progress, create sub-issue (LIN-60)      | —            |
| M8-04  | [ ]    | Issue relations: blocks / blocked by / related / duplicate of (LIN-63)                 | —            |
| M8-05  | [ ]    | Issue links: add link (Ctrl L), resources list, GitHub PR rows (LIN-66)                | M4-07        |
| M8-06  | [ ]    | Cycles: team settings, auto-scheduled cycles, cycle picker, cycle page (LIN-70)        | —            |
| M8-07  | [ ]    | Favorites: star issues, projects, views; sidebar Favorites section (LIN-73)            | M7-01        |

## M9 — Projects parity

| ID     | Status | Task                                                                                   | Depends on   |
| ------ | ------ | -------------------------------------------------------------------------------------- | ------------ |
| M9-01  | [ ]    | Project properties + projects list table: priority, lead, members, dates, labels (LIN-57) | —         |
| M9-02  | [ ]    | Project milestones: create/reorder, assign issues, progress per milestone (LIN-61)     | M9-01        |
| M9-03  | [ ]    | Project detail: Overview / Activity / Issues tabs with right properties panel (LIN-65) | M9-02        |
| M9-04  | [ ]    | Project updates + health (On track / At risk / Off track) (LIN-68)                     | M9-03        |
| M9-05  | [ ]    | Project progress chart: scope / started / completed + breakdowns (LIN-71)              | M9-02        |
| M9-06  | [ ]    | Project activity feed (LIN-75)                                                         | M9-01        |

## M10 — Collaboration and views

| ID     | Status | Task                                                                                   | Depends on   |
| ------ | ------ | -------------------------------------------------------------------------------------- | ------------ |
| M10-01 | [ ]    | Subscribers: auto-subscribe, subscribe toggle, subscribers on issue (LIN-64)           | —            |
| M10-02 | [ ]    | Inbox + notifications (LIN-69)                                                         | M10-01, M7-01 |
| M10-03 | [ ]    | @mentions of users and issues in descriptions and comments (LIN-74)                    | M10-01, M10-02 |
| M10-04 | [ ]    | Comment reactions and threaded replies (LIN-77)                                        | —            |
| M10-05 | [ ]    | Custom views: save filters + display options as workspace or team views (LIN-79)       | M7-01, M7-03 |
| M10-06 | [ ]    | Issue templates (LIN-81)                                                               | —            |
| M10-07 | [x]    | Presence: who is viewing an issue, online status on avatars (LIN-83)                   | M6-01        |

## P1 backlog (after P0)

Most of this list is now scheduled in M7–M10 (shortcuts, command menu, notifications, presence, due dates, sub-issues, project progress, relations). Still unscheduled: draft/review PR indicators.

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
2026-10-30 · M4-01 · GitHub tables, enums, indexes, migration and uniqueness integration tests; PR #6 CI and local checks pass lint, typecheck, all tests (including three schema constraints), and build; fresh migration verified on Podman PostgreSQL.
2026-10-30 · M4-02 · parsePrIdentifiers (branch/title/body → closing/reference, closing wins, deduped) + unit tests
2026-10-30 · M2-06 · StatusIcon/PriorityIcon (status/priority/floating tokens), Status/Priority/Assignee/Label pickers on shadcn popover + command; UserAvatar already existed; design.md "Product UI (App)" makes Linear's product UI the reference
2026-10-30 · M2-03 · labels + issue_labels tables, labels list/create/update/delete (any member), CONFLICT on duplicate name, cross-workspace NOT_FOUND tests
2026-10-30 · M2-02 · issues create/get/getByIdentifier/update/delete/list (any member), id-cursor pagination newest first, labelIds replace set, completedAt follows category; cross-workspace NOT_FOUND tests
2026-10-30 · M4-04 · raw-body GitHub webhook signature verification, delivery deduplication/persistence, ignored events, ID-only queue jobs; real Postgres/Redis integration coverage; lint, typecheck, full tests and build pass.
2026-10-30 · LIN-34 / M3-01 · projects schema, CRUD, category progress, workspace validation and icon binding; row locking serializes team replacements. Complete; PR #12. After merging updated develop, all 223 tests pass (71 API tests), along with lint, typecheck and build. Fresh migration and reapplication verified on disposable Podman PostgreSQL database; issue project FK uses ON DELETE SET NULL.
2026-10-30 · M4-06 · github.installUrl/completeInstall (signed state + OAuth installation check, ADR 0009), owner-only repositories list/connect/disconnect with CONFLICT across workspaces, settings GitHub section + /setup/github callback; integration tests on a fake GitHub client
2026-10-30 · M2-05 · activity_log table; one entry per changed field written in the create/update transaction; activity.list (oldest first, cursor)
2026-10-30 · LIN-34 / M3-01 · merged activity-log updates from develop; preserved activity migration 0004 and sequenced unchanged projects SQL as 0005 with regenerated snapshot. Full tests (77 API tests), lint, typecheck and build pass; fresh migration and reapplication verified using Podman PostgreSQL.
2026-10-30 · M4-05 · github-webhooks worker: one transaction per delivery (upsert PR, merged terminal, reconcile links in the repo's workspace, evaluate(), github activity with PR reference); job tests for PRD tests 3–9 + out-of-order
2026-10-30 · M2-07 · virtualized issue list grouped by status (collapsible, scroll-paged, scroll-anchored), create issue dialog with Tiptap markdown editor (slash menu, selection toolbar), Create more, `C` hotkey; inset app shell; new issues default to Backlog; `db:seed:issues` for 1 000+ issue checks
2026-10-30 · M2-07 · follow-up: issue attachments (paperclip/⌘⇧U/paste/drop, inline images, file chips, `attachment:` refs resolved via membership-checked presigned GETs), Linear's full `/` menu with shortcuts (media, files, code, mermaid diagrams, LaTeX, `+++` collapsible sections), markdown round-trip tests
2026-11-03 · LIN-39 / M3-02 · projects table (icon, name, teams, progress, status), lazy `/:workspaceSlug/project/:projectId` detail page with in-place edits and the project's issues via `IssueList`, `CreateProjectDialog` (vee-validate + contract schema), shared `ImageUploadButton` for avatar and project icon, `ProjectPicker` in the create issue dialog. Contract: project DTOs gain `progress`/`iconUrl`/`createdAt`; `issues.list` takes `projectId`. Lint, typecheck and all tests pass; checked in light and dark.
2026-11-03 · LIN-35 / M3-03 · My Issues page with Assigned/Created tabs (URL-synced `?tab=`, keyboard tablist) reusing `IssueList` with a per-tab empty state and "Create issue" (preassigned from Assigned). Contract: `issues.list` takes `assignee: 'me'` / `creator: 'me'`, resolved to the session user; API test covers cross-user and cross-workspace isolation.
2026-11-03 · LIN-11 / M2-04 · comments table (cascade with issue, migration 0007), `comments.list` (oldest first, cursor) / `create` / `update` (author only) / `delete` (author or owner, per domain.md Roles); DTO carries author name + avatar URL. Integration tests cover create/list, paging, FORBIDDEN edits/deletes, cascade and cross-workspace NOT_FOUND. Lint, typecheck and all tests pass.
2026-11-03 · LIN-15 / M2-09 · `useUpdateIssue()` patches the infinite list and detail caches optimistically (cancel → snapshot → patch, rollback + toast on error, invalidate after the last in-flight change); compact status/priority/assignee/label pickers on issue rows; pure cache helpers in `issue-cache.ts` with unit tests. Checked with a 3 s delayed and a failing `issues.update` in the browser, light and dark. Lint, typecheck and all tests pass.
2026-11-03 · LIN-46 / M5-01 · PRD §12 Tests 1–9 as `acceptance: <n> <title>` files in `apps/api/test/acceptance/`; Tests 3–9 post signed GitHub fixtures to `/webhooks/github` and run the real GitHub worker (`@linear/worker/testing`, test-only) on the `test` queue prefix. Map in `docs/testing.md`. All 9 green in CI with lint, typecheck and the full suite.
2026-11-03 · LIN-50 · attachment lifecycle: `issue_attachments` link table (migration 0009 with backfill from existing descriptions), synced from `attachment:` refs on issue create/update (non-ready, foreign or non-attachment uploads → BAD_REQUEST), issue delete marks unshared attachments deleted and enqueues `delete-objects`, hourly `cleanup-attachments` sweep for attachments unlinked 24 h. Core parse unit test, API + worker tests.
2026-11-03 · LIN-49 · team issue defaults: `teams.default_status_id` (composite FK to the same team's status) / `default_priority` / `default_assignee_id`, migration 0009 with backfill; owner-only `teams.update`, `teams.get` returns the resolved defaults; `issues.create` falls back to them (`pickDefaultStatus` unit-tested); team settings page (`/team/:key/settings`, linked from Teams) with optimistic pickers; create dialog preselects team defaults, `default-status.ts` removed. API tests cover role check, cross-workspace NOT_FOUND and validation.
2026-11-03 · LIN-36 / M3-04 · board view (`IssueBoard` → `BoardColumn` → `BoardCard`, lazy-loaded) on the team and All issues pages with a list/board toggle in the panel header (persisted in the preferences store). Native drag and drop and the card's status picker (keyboard) move issues through the optimistic `useUpdateIssue()`; columns per status in workflow order, merged across teams by category + name, virtualized, all pages loaded in the background. Pure `board-columns.ts` with unit tests; `board-card` token. Verified in the browser with ~3 600 issues: drag, reload, keyboard move and rollback on a failing update, light and dark. Lint, typecheck and all tests pass.
2026-11-03 · LIN-14 / M2-08 · lazy `/:workspaceSlug/issue/:identifier` detail page (rows in the list link to it): editable title, markdown description, combined comments + activity timeline with readable change descriptions, comment composer (⌘↵) that refreshes without reload, properties sidebar (status/priority/assignee/labels/project pickers, created/updated) with optimistic saves, empty "Linked pull requests" placeholder for M4-07, not-found state. Unit tests for timeline merge/wording and relative time. Lint, typecheck and all tests pass; detail page edits go through the shared `useUpdateIssue()` (patch extended to title/description/project); checked in the browser in light and dark (row click, property edits, title, comments without reload, not-found, `S` picker hotkey).
2026-11-03 · LIN-44 / M5-04 · README (Docker-only quick start, dev setup, every env var, GitHub App + tunnel + fallback, demo script, light/dark screenshots); production `Dockerfile` (`server` + nginx `app`) and `docker-compose.prod.yml` with migrate/seed job; Release workflow builds, smoke-tests and pushes `:prod` / `:sha-*` to GHCR on `main`; `demo:github` sends signed PR webhooks (verified Backlog → In Progress → Done in the prod stack); `S3_PUBLIC_ENDPOINT`; blank env values count as unset.
2026-11-03 · LIN-51 / M6-01 · `realtime.subscribe` (oRPC `eventIterator`) over a WebSocket at `/rpc/ws` (`@fastify/websocket`, upgrade needs a session and the app `Origin`, `requireWorkspace` before any event); ID-only `issue.*`/`comment.*` events published by the API and by the worker after GitHub automation to Redis `workspace:<id>`, fanned out per API instance with reference-counted channel subscriptions (ADR 0011). App: `useRealtime` in `WorkspaceLayout` patches updated issues into list/board/detail caches, refetches lists only for create/assignee/project, refetches comments; per-tab `x-client-id` suppresses echoes; reconnect with jittered backoff and resync. Vite proxy and nginx pass the upgrade. Integration tests: member receives a teammate's changes and worker automation, outsider gets `NOT_FOUND` and no events, 401/403 upgrades, echo suppression. Checked end to end through the Vite proxy against the dev stack. Lint, typecheck, all tests and build pass.
2026-11-03 · LIN-37 / M3-05 · `issues.list` filters (status, priority, assignee incl. none, project incl. none, labels any-of), sorts (created / updated / priority with No priority last, asc/desc) with opaque keyset cursors, `q` title or identifier search; list indexes migration 0010; `teams.list` returns statuses. App: filter bar, sort menu, debounced search, `useIssueFilters()` synced to the route query, on the list and the board. Integration tests for every filter, sort (paged walk per sort) and identifier search.
2026-11-03 · LIN-45 / M4-07 · `github.pullRequests.listForIssue` (any member, workspace-scoped, plain array of a reusable `LinkedPullRequest` DTO: id, number, title, url, repoFullName, state, linkType, updatedAt; newest first) in `packages/core/src/github/pull-requests.ts`. Issue sidebar lists linked PRs (state icon in status tokens, title, mono `repo#number`, Closes/References, Open/Draft/Merged/Closed badge, opens GitHub in a new tab); GitHub activity entries show the GitHub mark and link their PR; `pullRequests` realtime field refetches the list. Integration tests (states, link types, order, member access, 401 / cross-workspace `NOT_FOUND`), unit tests for display helpers and the realtime refetch. Checked in the browser in light and dark, keyboard focus. Lint, typecheck, all tests and build pass.
2026-11-03 · LIN-42 / M5-03 · accessibility + both-theme pass over every page (auth, setup, my issues, list, board, issue detail, projects, project detail, teams, team settings, settings, create dialogs, pickers, 404) at 1280×800 and 1440×900 with axe-core and a keyboard tab walk. Fixes: light `ink-subtle` → #686c73 (4.5:1 on `group-band`/`surface-2`); new `link` token (dark #828fff) for auth and markdown links; board cards open by click/Enter via a stretched title link (drag still works); focus ring on the filter chip remove button; decorative avatars hidden from screen readers; named picker listboxes; 404 has an `h1`. Only open modal menus still trip axe (Reka's `aria-hidden` on the background while focus is trapped). Lint, typecheck, all tests and build pass.
2026-11-03 · LIN-53 / M7-01 · Linear app shell: sidebar with workspace menu (workspaces, Settings, Teams, theme, log out; replaces the footer user menu), Search and New issue icon buttons, Inbox (badge hidden until M10-02) and My issues, collapsible Workspace (All issues, Projects, Views) and Your teams sections with per-team Issues / Projects / Views; expansion persisted in the preferences store (`sidebar-sections`), opening a team page expands it. Routes `inbox`, `views`, `team/:teamKey/{issues,projects,views}` (lazy), `team/:teamKey` redirects to issues. `PageHeader` composite (breadcrumb, favorite slot, page actions, notifications bell, New issue) on every workspace page; help popover stand-in for M7-11. Unit tests for section state and team routes. Checked at 1280×800 in light and dark. Lint, typecheck, all tests and build pass.
2026-11-03 · LIN-78 / M7-10 · assignee picker parity: No assignee (0), you (1), then a "Team members" section sorted by name (2–9), search by name or email (`orderAssignees` in `lib/assignee-options.ts`, unit-tested); `PickerPopover` gains a `groups` slot for sectioned pickers; same picker in create dialog, detail, rows and board cards. No contract change (teams are open to all workspace members).
2026-11-03 · LIN-83 / M10-07 · presence in Redis only (`presence:<ws>:<user>` hash per connection with 60 s TTL, `presence:<ws>` sorted set pruned on read, `presence:<ws>:seen` for last seen); `presence.heartbeat` accepted only over the realtime socket for a subscribed workspace with an in-workspace issue (else dropped), socket close clears that connection; ID-only `presence.changed` events; `presence.list` returns current members only. App: `usePresence()` heartbeats every 20 s / on issue and visibility change, `UserAvatar` online/away dot (`success` token, surface ring), self-contained `IssueViewers` stack (max 3 + "+N", "Ada is viewing") in the issue header, Members list status text. Tests: TTL expiry, disconnect, cross-workspace/HTTP heartbeats ignored, non-members never listed. Checked two clients on one issue in light and dark. Lint, typecheck, all tests and build pass.
