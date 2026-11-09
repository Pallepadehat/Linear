# Product Requirements Document (PRD)

# Linear-Inspired Issue & Project Management Platform

**Version:** 1.1  
**Status:** Draft — Ready for Development  
**Changes in 1.1:** Tech stack moved to a Turborepo monorepo (Vue 3 app, Fastify + oRPC API, BullMQ worker), MinIO file storage, FR-14 uploads.  
**Project Type:** Full-Stack School Project  
**Product Category:** Project Management / Issue Tracking  
**Primary Users:** Developers, students, and small software teams  
**Reference Product:** Linear  
**Primary Differentiator:** Automatic GitHub pull request linking and issue status synchronization

---

## 1. Product Overview

### 1.1 Summary

The product is a modern project management and issue tracking platform inspired by Linear.

It enables software development teams to organize work into workspaces, teams, projects, and issues through a clean and responsive interface.

The platform integrates with GitHub to automatically associate pull requests with issues using identifiers such as `TIP-200`.

When a linked pull request is opened, the corresponding issue can automatically move to **In Progress**. When the pull request is successfully merged, the issue can automatically move to **Done**, according to configurable automation rules.

The goal is to create a functional, polished, and technically robust alternative to the core issue-management experience offered by Linear.

### 1.2 Problem Statement

Small development teams often manage their work across separate issue trackers and GitHub repositories.

Developers must manually update issue statuses as development progresses, which causes unnecessary administrative work, outdated project boards, and reduced visibility into development progress.

Teams need a centralized place to organize tasks, track responsibilities, and see the current state of development without repeatedly switching between tools or manually synchronizing information.

### 1.3 Product Vision

Create a fast, minimal, and developer-focused issue tracking experience that keeps project planning synchronized with actual development activity.

The product should make it easy to:

- Organize software projects.
- Create and assign issues.
- Track development progress.
- Collaborate with team members.
- Associate GitHub pull requests with issues.
- Automate issue status changes based on GitHub events.

### 1.4 Target Audience

**Primary:** Students and small software development teams working on GitHub-hosted projects.

**Secondary:** Individual developers who need a lightweight issue tracker for personal projects.

The MVP is optimized for teams of approximately 1–10 members.

---

## 2. Goals and Success Metrics

### 2.1 Product Goals

**G1 — Issue Management**

Users can create, organize, assign, and track issues within teams and projects.

**G2 — Usability**

Users can navigate the application and update issue properties without unnecessary page transitions.

**G3 — GitHub Integration**

Users can connect repositories and automatically associate pull requests with issues.

**G4 — Workflow Automation**

GitHub pull request activity can trigger reliable issue status updates.

**G5 — Project Visibility**

Users can understand the current status of their assigned work and projects.

### 2.2 Measurable Success Criteria

| Metric                       | Target                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| Create an issue              | Under 30 seconds in usability testing                       |
| Issue creation reliability   | 100% in acceptance tests                                    |
| Issue lookup                 | Correct issue returned by identifier                        |
| PR linking                   | At least 95% of valid test cases                            |
| Automatic status changes     | 100% of supported webhook test cases                        |
| Duplicate webhook handling   | No duplicate PR links or unwanted status transitions        |
| GitHub merge synchronization | Within 10 seconds of webhook receipt under normal operation |
| Main dashboard load time     | Under 2 seconds in the school demo environment              |
| Core workflows               | All P0 acceptance tests passing                             |

These targets are development acceptance criteria rather than existing performance measurements.

### 2.3 Primary Success Scenario

1. A user creates a workspace named `Tip`.
2. The user creates a team with identifier `TIP`.
3. The user creates an issue named `Fix login validation`.
4. The platform assigns the identifier `TIP-200` when the team's issue counter reaches 200.
5. The user creates a GitHub branch named `tip-200-fix-login-validation`.
6. A GitHub pull request is opened from the branch.
7. The platform identifies and associates the pull request with `TIP-200`.
8. The issue displays the pull request and changes to In Progress.
9. The pull request is merged.
10. The platform automatically changes the issue to Done.

**Success:** The entire GitHub synchronization flow works without manually updating the issue.

---

## 3. MVP Scope

### 3.1 In Scope — P0

- User authentication.
- Workspace creation.
- Team creation and membership.
- Unique team-based issue identifiers.
- Issue creation, editing, and deletion.
- Status, priority, assignee, and labels.
- Issue descriptions and comments.
- Projects and project issue assignment.
- Issue list view.
- Kanban board view.
- Basic issue search, filtering, and sorting.
- My Issues view.
- GitHub repository connection.
- Automatic PR linking from issue identifiers.
- GitHub pull request synchronization.
- Automatic issue status transitions.
- Responsive desktop-oriented interface.
- Light and dark themes with a system-preference option.
- File uploads: user avatars and workspace/project icons (MinIO).

### 3.2 Should Have — P1

- Keyboard shortcuts.
- Global command menu.
- Rich-text editor.
- Issue activity history.
- Notifications.
- Issue due dates.
- Sub-issues.
- Project progress indicators.
- Multiple pull requests per issue.
- Issue relations and blockers.
- Issue and comment attachments (MinIO).
- Draft and review PR indicators.
- GitHub integration settings.

### 3.3 Out of Scope — P2

The initial product will not implement:

- AI-powered issue generation or agents.
- Advanced enterprise permissions.
- Advanced project analytics.
- Roadmaps and cross-project initiatives.
- Two-way GitHub Issues synchronization.
- GitHub code review inside the platform.
- Automated deployment tracking.
- Native mobile applications.
- Billing and subscriptions.
- Advanced workflow automation builders.
- Third-party integrations other than GitHub.
- Complex collaborative document editing.

These may be considered after the MVP has been completed.

---

## 4. User Roles

### 4.1 Workspace Owner

Can create a workspace, configure workspace settings, manage members, create teams, and configure GitHub integrations.

### 4.2 Workspace Member

Can view permitted teams and projects, create and manage issues, comment, and assign work.

### 4.3 MVP Permission Model

The initial application will have two roles:

- **Owner:** Full workspace and integration configuration access.
- **Member:** Normal issue and project management access.

Complex organization-level permission systems are excluded from the MVP.

---

## 5. Functional Requirements

### FR-01 — Authentication

**Priority:** P0

Users must be able to create accounts, log in, and log out securely.

Requirements:

- Email and password authentication.
- Persistent authenticated sessions.
- Protected application routes.
- User profile containing name, email, and avatar.
- Passwords securely hashed and never stored in plaintext.
- Workspace data accessible only to authorized members.

**Acceptance Criteria**

- Unauthenticated users cannot access protected pages.
- Registered users can sign in and sign out.
- Sessions persist across page refreshes.
- Unauthorized users cannot access another workspace's data.

### FR-02 — Workspaces

**Priority:** P0

Users must be able to create workspaces that contain teams, projects, and members.

Required fields:

- Workspace ID.
- Workspace name.
- Unique workspace slug.
- Creator ID.
- Creation timestamp.

**Acceptance Criteria**

- A user can create a workspace.
- A workspace has a unique URL slug.
- Workspace members can view their workspace data.
- A user may belong to multiple workspaces.
- Workspace resources are isolated from unrelated workspaces.

### FR-03 — Teams

**Priority:** P0

Workspaces contain teams that organize issues.

Example:

**Team:** Tip Development  
**Identifier:** `TIP`

Requirements:

- Team name.
- Unique team identifier within a workspace.
- Team membership.
- Team issue counter.
- Default workflow statuses.

**Acceptance Criteria**

- Users can create teams.
- Team identifiers are unique within a workspace.
- Issues are assigned sequential numbers within their team.
- Issue identifiers such as `TIP-200` remain unique.
- Concurrent issue creation never creates duplicate identifiers.

### FR-04 — Issue Management

**Priority:** P0

Issues represent actionable pieces of work.

Each issue must include:

| Property     | Description                             |
| ------------ | --------------------------------------- |
| ID           | Internal UUID                           |
| Identifier   | Human-readable identifier, e.g. TIP-200 |
| Title        | Short issue summary                     |
| Description  | Detailed issue information              |
| Status       | Current workflow state                  |
| Priority     | Importance level                        |
| Assignee     | Responsible user                        |
| Creator      | User who created the issue              |
| Team         | Owning team                             |
| Project      | Optional project                        |
| Labels       | Zero or more labels                     |
| Created At   | Creation timestamp                      |
| Updated At   | Last modification timestamp             |
| Completed At | Optional completion timestamp           |

#### Default Statuses

- Backlog
- Todo
- In Progress
- Done
- Canceled

#### Default Priorities

- Urgent
- High
- Medium
- Low
- No Priority

**Acceptance Criteria**

- Users can create an issue with a title and team.
- The system automatically generates an issue identifier.
- Users can edit title, description, status, priority, assignee, project, and labels.
- Users can delete issues according to workspace permissions.
- Issues can be retrieved directly by their identifier.
- Issue updates are persisted in the database.

### FR-05 — Issue Details and Comments

**Priority:** P0

Each issue must have a dedicated detail view.

Required sections:

- Issue title.
- Editable description.
- Status and priority.
- Assignee.
- Labels.
- Associated project.
- Comments.
- Linked GitHub pull requests.

**Acceptance Criteria**

- Selecting an issue opens its detail view.
- Users can view and edit issue properties.
- Members can create comments.
- Comments display their author and creation date.
- Linked GitHub PRs are visible.

### FR-06 — Projects

**Priority:** P0

Projects group related issues into larger development initiatives.

Required properties:

- Project ID.
- Name.
- Description.
- Status.
- Workspace.
- Associated teams.
- Associated issues.
- Creation timestamp.

Default project statuses:

- Planned
- In Progress
- Completed
- Canceled

**Acceptance Criteria**

- Users can create, edit, and view projects.
- Issues can be associated with projects.
- A project detail page displays its issues.
- Project progress can be calculated from completed and total issues.

### FR-07 — Issue Views

**Priority:** P0

The application must provide multiple ways to view work.

**List View**

Shows issues in a compact table or row layout, displaying identifier, title, priority, status, assignee, and project.

**Board View**

Shows issues in columns grouped by workflow status.

**My Issues**

Displays issues assigned to the authenticated user.

**Acceptance Criteria**

- Users can switch between list and board views.
- Issues can be filtered by status, priority, assignee, project, and labels.
- Issues can be sorted by creation date, updated date, and priority.
- Users can search by title or issue identifier.
- Moving an issue between board columns updates its status.

### FR-08 — Workspace Navigation

**Priority:** P0

The application must provide clear navigation between its main areas.

Primary navigation:

- My Issues
- All Issues
- Projects
- Teams
- Settings

The sidebar must show workspace identity and allow switching between teams.

**Acceptance Criteria**

- Every major feature is accessible through the sidebar.
- Selecting an issue opens the correct detail page.
- Navigation retains the current workspace context.
- The interface is usable at common laptop screen sizes.

---

### FR-14 — File Uploads and Media

**Priority:** P0 (avatars, workspace/project icons) · P1 (issue and comment attachments)

Users can upload images that are stored in S3-compatible object storage (MinIO).

Requirements:

- Users can upload and replace a profile avatar.
- Workspace owners can upload a workspace icon.
- Members can upload a project icon.
- Members can attach images and files to issue descriptions and comments.
- Uploads go directly from the browser to object storage using short-lived presigned URLs; file bytes never pass through the API.
- The API validates file type and size before issuing a presigned URL.
- Uploaded images are processed in the background (resize, thumbnail generation, metadata stripping).
- Files are only readable by members of the owning workspace (private bucket, presigned GET URLs).

Limits (MVP defaults):

| Type        | Allowed formats              | Max size |
| ----------- | ---------------------------- | -------- |
| Avatar      | PNG, JPEG, WebP              | 2 MB     |
| Icon        | PNG, JPEG, WebP, SVG (sanitized) | 1 MB |
| Attachment  | Images, PDF, plain text, zip | 25 MB    |

**Acceptance Criteria**

- A user can upload an avatar and see it in the sidebar and on assigned issues.
- An upload exceeding the size limit is rejected before reaching storage.
- A file belonging to workspace A cannot be fetched by a member of workspace B.
- Deleting an issue or comment schedules deletion of its attachments.

---

## 6. GitHub Integration Requirements

### FR-09 — GitHub Repository Connection

**Priority:** P0

Workspace owners must be able to connect GitHub repositories to their workspace.

The preferred integration mechanism is a GitHub App.

Requirements:

- GitHub App installation support.
- Selection of repositories authorized for the installation.
- Persistent association between GitHub installations, repositories, and workspaces.
- Webhook event reception.
- Secure webhook signature verification.
- Repository connection management.

For the first development prototype, a manually configured repository webhook is an acceptable intermediate implementation.

**Acceptance Criteria**

- The workspace owner can connect an authorized repository.
- The application stores the repository's GitHub ID.
- GitHub PR webhook events are received.
- Invalid webhook signatures are rejected.
- Events from unconnected repositories cannot modify workspace issues.

### FR-10 — Automatic Pull Request Linking

**Priority:** P0

The system must recognize issue identifiers in GitHub pull request metadata.

Supported patterns:

**Branch name**

`tip-200-fix-login`

**Pull request title**

`TIP-200 Fix login validation`

**Pull request description**

`Fixes TIP-200`

Additional supported reference keywords:

- `Closes TIP-200`
- `Resolves TIP-200`
- `Refs TIP-200`
- `Related to TIP-200`

#### Linking Rules

1. Issue identifiers are matched case-insensitively.
2. Only issues belonging to the authorized workspace can be linked.
3. The same PR cannot be linked twice to the same issue.
4. A single PR may reference multiple issues.
5. One issue may contain multiple linked PRs.
6. Editing a PR may add or remove detected issue relationships.
7. Closing keywords and reference-only keywords must be distinguishable.

#### Pull Request Information

Linked PRs must display:

- PR number.
- PR title.
- GitHub repository.
- GitHub URL.
- PR state.
- Draft state.
- Merge state.
- Merge timestamp where available.

**Acceptance Criteria**

- Opening a PR containing `TIP-200` links it to the correct issue.
- The linked PR appears on the issue detail page.
- Repeated webhook deliveries do not create duplicate links.
- A PR referencing multiple valid issue identifiers can link to each issue.
- A PR referencing an invalid or unauthorized identifier does not modify that issue.

### FR-11 — GitHub PR Status Synchronization

**Priority:** P0

The platform must process relevant GitHub pull request events and maintain the current PR state.

Supported event actions:

| Event                   | Expected Behavior                                  |
| ----------------------- | -------------------------------------------------- |
| PR opened               | Create or update stored PR and resolve issue links |
| PR edited               | Refresh PR metadata and issue relationships        |
| PR reopened             | Mark stored PR as open                             |
| PR ready for review     | Update draft state                                 |
| PR converted to draft   | Update draft state                                 |
| PR closed without merge | Mark PR closed without completing the issue        |
| PR merged               | Mark PR merged and evaluate issue completion       |

The integration must use the actual GitHub merge flag rather than assuming every closed PR has been merged.

**Acceptance Criteria**

- Stored PR state reflects supported GitHub events.
- A merged PR displays as Merged.
- A closed, unmerged PR displays as Closed.
- Draft PRs can be distinguished from review-ready PRs.
- Duplicate deliveries do not create duplicate status updates.

### FR-12 — Automatic Issue Status Updates

**Priority:** P0

The application must support automatic issue status transitions based on linked GitHub pull requests.

#### Rule A — PR Opened

When an eligible PR is opened and linked to an issue:

`Todo → In Progress`

For MVP, issues already marked Done or Canceled will not be reopened automatically.

#### Rule B — PR Merged

When a PR is successfully merged, the system evaluates the linked issues.

If an issue has exactly one required, closing-type PR and that PR merges:

`In Progress → Done`

#### Rule C — Multiple PRs

If an issue contains multiple required PRs, it is completed only when all required PRs are successfully merged.

Example:

**Issue:** TIP-200

- PR #42 — Merged
- PR #43 — Open

**Issue Status:** In Progress

When PR #43 merges:

**Issue Status:** Done

#### Rule D — Reference-Only Relationships

A PR linked using `Refs TIP-200` or `Related to TIP-200` must not automatically complete that issue.

#### Rule E — Closed Without Merge

When a PR is closed but not merged, the issue must not automatically transition to Done.

#### Rule F — Manual Override

Users may change issue statuses manually.

For MVP, automated transitions apply only when eligible and must not overwrite a Canceled issue or reopen an already completed issue. More advanced manual override policies are deferred.

**Acceptance Criteria**

- Opening an eligible PR can move a Todo issue to In Progress.
- Merging the only required PR marks the issue Done.
- Merging one of several required PRs does not complete the issue prematurely.
- A closed, unmerged PR never causes automatic completion.
- Reference-only links do not trigger completion.
- Reprocessing an event does not create repeated transitions.

### FR-13 — Webhook Reliability and Security

**Priority:** P0

GitHub integration must be reliable and secure.

Requirements:

- Verify GitHub webhook HMAC-SHA256 signatures.
- Use environment-managed secrets.
- Validate installation and repository ownership.
- Persist GitHub delivery identifiers.
- Process webhook deliveries idempotently.
- Handle transient processing failures.
- Protect against unauthorized cross-workspace issue access.
- Avoid exposing GitHub credentials in the browser.
- Log webhook processing failures.

For production-like reliability, event processing should reconcile the current PR state rather than relying on event arrival order.

**Acceptance Criteria**

- Invalid signatures return an unauthorized response.
- The same delivery processed multiple times has one logical effect.
- Out-of-order webhook events do not regress a merged PR to Open.
- Errors can be inspected through server logs.
- A repository from one workspace cannot change issues in another workspace.

---

## 7. User Experience Requirements

### 7.1 Design Direction

The design should be inspired by Linear's minimal and efficient interface without relying on exact proprietary assets.

The design system is defined in `docs/design.md` (colors, surface ladder, typography, spacing, radii, components). Its tokens are mapped to Tailwind v4 `@theme` variables and shadcn-vue CSS variables in `apps/app/src/styles/globals.css`. The app ships dark and light themes (plus "system"), defined in the "Themes (App)" section of `docs/design.md`; Inter and JetBrains Mono are used as substitutes for Linear's proprietary fonts. In-product status and priority colors (see "Known Gaps" in `docs/design.md`) are defined as additional tokens.

Design characteristics:

- Minimal visual clutter.
- Consistent spacing.
- Compact information-dense layouts.
- Neutral colors.
- Clear status indicators.
- Fast interactions.
- Accessible focus states.
- Responsive layouts.
- Dark and light themes with equal polish.

### 7.2 Core Screens

**Screen 1 — Authentication**

Login and registration.

**Screen 2 — Workspace Setup**

Create a workspace and its first team.

**Screen 3 — My Issues**

Display issues assigned to the authenticated user.

**Screen 4 — All Issues**

List and filter issues across the current workspace.

**Screen 5 — Issue Details**

Edit properties, read comments, and inspect linked GitHub PRs.

**Screen 6 — Kanban Board**

View and move issues between workflow statuses.

**Screen 7 — Projects**

Create projects and manage their issues.

**Screen 8 — Settings**

Manage the workspace, teams, members, and GitHub repositories.

### 7.3 Essential User Flows

**Flow 1: Create an issue**

Workspace → Team → Create Issue → Enter Title → Save → Generated Identifier

**Flow 2: Assign an issue**

Issue Details → Assignee → Select Member → Save

**Flow 3: Change issue status**

Issue Details → Status → Select Status

**Flow 4: Connect GitHub**

Workspace Settings → Integrations → GitHub → Install / Authorize → Select Repositories

**Flow 5: Link GitHub PR**

Create Issue → Use Issue Identifier in GitHub Branch or PR → Receive Webhook → Display PR on Issue

**Flow 6: Complete issue automatically**

Linked PR → Merge into Target Branch → Receive GitHub Webhook → Evaluate Merge Rules → Change Issue to Done

---

## 8. Technical Requirements

### 8.1 Technology Stack

| Area                | Technology                                                        |
| ------------------- | ----------------------------------------------------------------- |
| Monorepo            | Turborepo                                                         |
| Package manager     | Bun (workspaces)                                                  |
| Runtime             | Bun (API and worker stay Node-compatible)                         |
| Language            | TypeScript (strict) everywhere                                    |
| **App (frontend)**  |                                                                   |
| Build tool          | Vite                                                              |
| Framework           | Vue 3 (Composition API, `<script setup lang="ts">`)               |
| Routing             | vue-router                                                        |
| UI components       | shadcn-vue (Reka UI primitives)                                   |
| Styling             | Tailwind CSS v4, tokens from `docs/design.md`                     |
| Server state        | TanStack Query (`@tanstack/vue-query`) via `@orpc/tanstack-query` |
| Client/UI state     | Pinia (UI-only state: sidebar, command menu, preferences)         |
| Forms & validation  | vee-validate + Zod (schemas shared from `packages/contract`)      |
| Large lists         | `@tanstack/vue-virtual`                                           |
| **API (backend)**   |                                                                   |
| HTTP server         | Fastify                                                           |
| API layer           | oRPC (contract-first, `@orpc/contract` + `@orpc/server`)          |
| Validation          | Zod                                                               |
| Authentication      | Better Auth (Drizzle adapter, email + password, sessions)         |
| Database            | PostgreSQL 16                                                     |
| ORM / migrations    | Drizzle ORM + drizzle-kit                                         |
| Background jobs     | BullMQ                                                            |
| Queue / cache       | Redis 7                                                           |
| Object storage      | MinIO (S3-compatible) via `@aws-sdk/client-s3`                    |
| Image processing    | sharp (in the worker)                                             |
| GitHub              | GitHub App, Octokit, `@octokit/webhooks` signature verification   |
| Logging             | pino (Fastify built-in)                                           |
| **Tooling**         |                                                                   |
| Testing             | Vitest (unit + API integration), Playwright (E2E, P1)             |
| Lint / format       | ESLint (flat config) + Prettier                                   |
| Local infra         | Docker Compose (Postgres, Redis, MinIO)                           |

### 8.2 System Architecture

```
┌──────────────┐  oRPC (HTTP, cookies)   ┌──────────────┐   Drizzle   ┌────────────┐
│  apps/app    │ ──────────────────────▶ │  apps/api    │ ──────────▶ │ PostgreSQL │
│  Vue 3 SPA   │ ◀── Better Auth ──────▶ │  Fastify     │             └────────────┘
└──────┬───────┘                         └──┬────────┬──┘                   ▲
       │ presigned PUT/GET                  │enqueue │presign               │
       ▼                                    ▼        ▼                      │
┌──────────────┐                     ┌─────────┐  ┌───────┐   consume  ┌──────────────┐
│    MinIO     │ ◀────────────────── │  Redis  │◀─│BullMQ │ ─────────▶ │ apps/worker  │
└──────────────┘    process images   └─────────┘  └───────┘            │ BullMQ jobs  │
                                                                       └──────────────┘
GitHub ──webhook──▶ apps/api /webhooks/github ──verify, persist delivery, enqueue──▶ worker
```

Responsibilities:

- **apps/app** — The only user-facing client. Never talks to the database, Redis, or GitHub directly. All data goes through oRPC; all auth through the Better Auth client.
- **apps/api** — Owns authentication, authorization, all reads/writes, presigned URL issuing, and the GitHub webhook receiver. Request handlers stay fast; anything slow or retryable is enqueued.
- **apps/worker** — Consumes BullMQ queues: GitHub webhook processing and automation, image processing, attachment cleanup, and (P1) notifications. Has no HTTP surface.

### 8.3 Monorepo Structure

```
.
├── apps/
│   ├── app/                 # Vite + Vue 3 SPA
│   ├── api/                 # Fastify + oRPC + Better Auth
│   └── worker/              # BullMQ workers
├── packages/
│   ├── contract/            # oRPC contract + Zod schemas + shared DTO types
│   ├── db/                  # Drizzle schema, migrations, client, seed
│   ├── core/                # Domain services shared by api + worker (issues, automation, activity)
│   ├── queue/               # Queue names, job payload schemas, Redis connection factory
│   ├── storage/             # MinIO/S3 client, bucket + key helpers, presign helpers
│   ├── env/                 # Zod-validated environment loaders per app
│   └── tsconfig/            # Shared tsconfig bases
├── docs/                    # prd.md, design.md
├── docker-compose.yml       # postgres, redis, minio (+ bucket init)
├── turbo.json
├── package.json             # Bun workspaces, root scripts
├── AGENTS.md
└── .env.example
```

Dependency direction (enforced by review):

```
app    → contract
api    → contract, core, db, queue, storage, env
worker → core, db, queue, storage, env
core   → db
```

`apps/app` must never import from `db`, `core`, `queue`, or `storage`.

### 8.4 Frontend Structure (`apps/app`)

Feature-based structure: code that changes together lives together.

```
apps/app/src/
├── main.ts                  # createApp, install plugins, mount
├── App.vue                  # <RouterView /> + global providers (Toaster, CommandMenu)
├── router/
│   ├── index.ts             # createRouter, history mode
│   ├── routes.ts            # route table, all pages lazy-loaded
│   └── guards.ts            # auth + workspace guards
├── layouts/
│   ├── AuthLayout.vue
│   └── WorkspaceLayout.vue  # sidebar + header + <RouterView />
├── features/
│   ├── auth/
│   │   ├── components/      # LoginForm.vue, RegisterForm.vue
│   │   ├── composables/     # useSession.ts
│   │   └── pages/           # LoginPage.vue, RegisterPage.vue
│   ├── workspaces/
│   ├── teams/
│   ├── issues/
│   │   ├── components/      # IssueList.vue, IssueRow.vue, IssueBoard.vue, StatusPicker.vue …
│   │   ├── composables/     # useIssueFilters.ts, useIssueMutations.ts
│   │   ├── pages/           # IssuesPage.vue, MyIssuesPage.vue, IssueDetailPage.vue
│   │   └── queries.ts       # query/mutation options built from the oRPC client
│   ├── projects/
│   ├── comments/
│   ├── uploads/             # useUpload.ts (presign → PUT → confirm)
│   ├── github/
│   └── settings/
├── components/
│   ├── ui/                  # shadcn-vue generated components (CLI-owned)
│   └── common/              # app-wide composites: UserAvatar, StatusIcon, PriorityIcon, EmptyState
├── composables/             # cross-feature: useHotkeys, useCurrentWorkspace, useTheme
├── stores/                  # Pinia, UI state only (ui.ts, preferences.ts)
├── lib/
│   ├── orpc.ts              # typed oRPC client + TanStack Query utils
│   ├── auth-client.ts       # Better Auth Vue client
│   ├── query-client.ts      # QueryClient defaults
│   └── utils.ts             # cn() and small helpers
├── styles/
│   └── globals.css          # Tailwind v4 @theme tokens; :root = light, .dark = dark
└── env.d.ts
```

Naming conventions:

- Components and pages: `PascalCase.vue`; pages end in `Page.vue`.
- Composables: `useThing.ts`; stores: `thing.ts` exporting `useThingStore`.
- Other files: `kebab-case.ts`.
- A feature exposes only what other features need; deep cross-feature imports are avoided.

Performance requirements:

- Every route component is lazy-loaded (`() => import(...)`); heavy widgets (rich-text editor, board drag-and-drop) are split with `defineAsyncComponent`.
- Server state lives only in TanStack Query — never copied into Pinia or local refs.
- Query keys come from the oRPC utils (`orpc.issues.list.queryOptions(...)`); no hand-written string keys.
- Issue mutations (status, priority, assignee, board moves) are optimistic with rollback on error.
- Issue lists over ~100 rows are virtualized.
- Hovering an issue row prefetches its detail query.
- Large read-only arrays use `shallowRef`; avoid deep watchers on query data.
- Icons are imported per-icon (`lucide-vue-next`), never as a full set.
- Target: initial JS for the authenticated shell under 200 KB gzip.

Theming:

- `useTheme()` wraps `useColorMode` from `@vueuse/core` with modes `light`, `dark`, `system` (default `system`).
- The choice is persisted in `localStorage` and, for signed-in users, in the user's preferences so it follows them across devices.
- A small inline script in `index.html` applies the `.dark` class before first paint (no flash of the wrong theme).
- shadcn-vue CSS variables (`--background`, `--foreground`, `--primary`, `--border`, …) are mapped onto the design tokens, so generated components theme automatically.
- The theme can be switched from the user menu, Settings → Preferences, and the command menu (P1).

### 8.5 Backend Structure (`apps/api`)

```
apps/api/src/
├── index.ts                 # start server
├── app.ts                   # buildApp(): Fastify instance + plugin registration (testable)
├── env.ts                   # re-export validated env from packages/env
├── plugins/
│   ├── cors.ts
│   ├── auth.ts              # mounts Better Auth at /api/auth/*
│   ├── orpc.ts              # mounts oRPC RPCHandler at /rpc/*
│   └── rate-limit.ts
├── auth/
│   └── auth.ts              # betterAuth({ database: drizzleAdapter(db), ... })
├── orpc/
│   ├── context.ts           # { db, session, user, logger, queues }
│   ├── base.ts              # implement(contract) + shared middleware
│   ├── middleware/
│   │   ├── require-auth.ts
│   │   └── require-workspace.ts  # resolves workspace, checks membership + role
│   └── router.ts            # assembles all module routers
├── modules/
│   ├── workspaces/workspaces.router.ts
│   ├── teams/teams.router.ts
│   ├── issues/issues.router.ts
│   ├── projects/projects.router.ts
│   ├── comments/comments.router.ts
│   ├── labels/labels.router.ts
│   ├── uploads/uploads.router.ts
│   └── github/github.router.ts
├── webhooks/
│   └── github.ts            # raw-body route: verify HMAC → insert delivery → enqueue → 202
└── lib/
    └── errors.ts            # ORPCError helpers, error mapping
```

Rules:

- **Contract-first.** Procedures are defined in `packages/contract` (input/output Zod schemas); `apps/api` implements them with `implement(contract)`. The app gets end-to-end types from the contract, not from the API source.
- **Thin routers.** Routers handle input, auth context, and response shaping. Business logic lives in `packages/core` services so the worker can reuse it.
- **Workspace scoping.** Every workspace-owned procedure goes through `requireWorkspace`; every query filters by `workspaceId`.
- **Webhook route is not oRPC.** It needs the raw body for signature verification and must respond quickly (`202`) after persisting the delivery and enqueueing a job.
- **Same-origin cookies.** In development the Vite dev server proxies `/api` and `/rpc` to the API, so Better Auth session cookies are first-party. Production serves both behind one domain.

### 8.6 Worker Structure (`apps/worker`)

```
apps/worker/src/
├── index.ts                 # starts all workers, graceful shutdown on SIGTERM
├── workers/
│   ├── github.worker.ts     # github-webhooks queue
│   ├── media.worker.ts      # media queue (resize, thumbnails, strip EXIF)
│   └── maintenance.worker.ts# cleanup of orphaned/deleted uploads
└── jobs/
    ├── github/
    │   ├── process-pull-request.ts
    │   └── reconcile-pull-request.ts
    └── media/
        └── process-image.ts
```

### 8.7 Background Jobs

| Queue             | Job                      | Trigger                         | Notes                                                                    |
| ----------------- | ------------------------ | ------------------------------- | ------------------------------------------------------------------------ |
| `github-webhooks` | `pull_request`           | Verified webhook received       | `jobId` = GitHub delivery ID (dedupe); links PRs and runs automation     |
| `github-webhooks` | `reconcile-pull-request` | After processing / on demand    | Fetches current PR state via Octokit so out-of-order events can't regress state |
| `media`           | `process-image`          | Upload confirmed                | sharp: resize, thumbnail, strip metadata, write variants to MinIO        |
| `maintenance`     | `delete-objects`         | Issue/comment/upload deleted    | Removes objects from MinIO                                               |
| `maintenance`     | `cleanup-pending`        | Repeatable (hourly)             | Deletes uploads never confirmed within 24 h                              |
| `notifications`   | `notify` (P1)            | Assignment, comment, mention    | In-app notifications                                                     |

Job rules:

- Payloads are validated with Zod schemas from `packages/queue`; they carry IDs, not full records.
- Jobs are idempotent; retries use exponential backoff (default 5 attempts).
- Failed jobs are retained for inspection and logged with the delivery/job ID.

### 8.8 File Storage (MinIO)

- One private bucket (`linear-uploads`); no public-read objects.
- Object keys: `workspaces/{workspaceId}/{kind}/{uploadId}/{variant}.{ext}`; avatars use `users/{userId}/avatar/{uploadId}/{variant}.{ext}`.
- Upload flow: `uploads.createPresignedUpload` (validates type/size, creates `Upload` row with status `pending`) → browser `PUT` to MinIO → `uploads.confirm` (verifies object exists, marks `ready`, enqueues `process-image`).
- Reads use short-lived presigned GET URLs issued after a membership check.

### 8.9 Architectural Modules

| Module      | Location                              | Responsibility                                              |
| ----------- | ------------------------------------- | ----------------------------------------------------------- |
| Auth        | `apps/api/src/auth`                   | Identities, sessions, password hashing (Better Auth)        |
| Workspace   | `core/workspaces` + api router        | Workspaces, teams, membership, roles                        |
| Issue       | `core/issues` + api router            | Issue CRUD, identifiers, statuses, filters, comments, labels|
| Project     | `core/projects` + api router          | Projects and their issues                                   |
| Upload      | `core/uploads`, `packages/storage`    | Presigning, upload records, cleanup                         |
| GitHub      | `core/github`, api webhook route      | Installations, repositories, PR metadata, webhook deliveries|
| Automation  | `core/automation` (run by the worker) | Evaluates PR state and applies permitted status transitions |

The GitHub and automation modules remain separate from normal issue CRUD. Automation rules are pure functions (`(issue, linkedPRs) → transition | null`) so they can be unit-tested without a database.

### 8.10 Database Entities

Managed by Better Auth (generated into `packages/db`):

- User
- Session
- Account
- Verification

Application:

- Workspace
- WorkspaceMember
- Team (includes `issueCounter`)
- TeamMember
- WorkflowStatus
- Project
- Issue
- Label
- IssueLabel
- Comment
- ActivityLog
- Upload
- GitHubInstallation
- GitHubRepository
- GitHubPullRequest
- IssuePullRequest
- WebhookDelivery

### 8.11 Key Database Constraints

- Users have unique account identities (unique email).
- Workspace slugs are unique.
- Team keys are unique within a workspace.
- Issue numbers are unique within a team (`unique(teamId, number)`).
- Issue numbers are allocated atomically inside the create transaction (`UPDATE team SET issue_counter = issue_counter + 1 RETURNING issue_counter`).
- GitHub repository IDs are globally unique.
- GitHub PR numbers are unique within repositories.
- Issue–PR relationships are unique for each issue and PR pair.
- GitHub webhook delivery IDs are unique.
- Upload object keys are unique.
- Every workspace-owned table has a `workspaceId` column and an index on it.
- Indexes on frequently filtered issue fields: `(teamId, statusId)`, `assigneeId`, `projectId`, `updatedAt`.
- Primary keys are UUIDv7 (or ULID); timestamps are `timestamptz`.

### 8.12 API Surface (oRPC)

All procedures live in `packages/contract`, grouped by router:

| Router       | Procedures                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| `auth`       | Handled by Better Auth at `/api/auth/*` (sign-up, sign-in, sign-out, session) |
| `me`         | `get`, `update`, `listWorkspaces`                                          |
| `workspaces` | `create`, `get`, `update`, `listMembers`, `inviteMember`, `removeMember`  |
| `teams`      | `create`, `get`, `update`, `list`, `addMember`, `removeMember`             |
| `issues`     | `create`, `get`, `getByIdentifier`, `update`, `delete`, `list`, `search`, `move` |
| `projects`   | `create`, `get`, `update`, `list`, `addIssue`, `removeIssue`               |
| `comments`   | `create`, `list`, `update`, `delete`                                       |
| `labels`     | `create`, `list`, `update`, `delete`                                       |
| `uploads`    | `createPresignedUpload`, `confirm`, `getUrl`, `delete`                     |
| `github`     | `installUrl`, `completeInstall`, `repositories.list`, `repositories.connect`, `repositories.disconnect`, `listPullRequestsForIssue` |

Non-oRPC HTTP routes:

| Route                    | Purpose                        |
| ------------------------ | ------------------------------ |
| `GET/POST /api/auth/*`   | Better Auth handler            |
| `POST /webhooks/github`  | GitHub webhook receiver        |
| `GET /health`            | Liveness (DB + Redis ping)     |

List procedures use cursor pagination. Errors use oRPC typed errors (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`).

### 8.13 Environment Variables

| Variable                    | Used by       | Example                                   |
| --------------------------- | ------------- | ----------------------------------------- |
| `DATABASE_URL`              | api, worker   | `postgres://linear:linear@localhost:5432/linear` |
| `REDIS_URL`                 | api, worker   | `redis://localhost:6379`                  |
| `BETTER_AUTH_SECRET`        | api           | random 32+ chars                          |
| `BETTER_AUTH_URL`           | api           | `http://localhost:5173`                   |
| `APP_URL`                   | api           | `http://localhost:5173` (CORS, trusted origins) |
| `S3_ENDPOINT`               | api, worker   | `http://localhost:9000`                   |
| `S3_PUBLIC_ENDPOINT`        | api, worker   | optional; browser-facing storage URL for presigned links (defaults to `S3_ENDPOINT`) |
| `S3_REGION`                 | api, worker   | `us-east-1`                               |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api, worker | MinIO credentials                     |
| `S3_BUCKET`                 | api, worker   | `linear-uploads`                          |
| `GITHUB_APP_ID`             | api, worker   |                                           |
| `GITHUB_APP_PRIVATE_KEY`    | api, worker   | PEM                                       |
| `GITHUB_APP_SLUG`           | api           | App URL name, for the install link        |
| `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` | api | OAuth during install (verifies installation access) |
| `GITHUB_WEBHOOK_SECRET`     | api           |                                           |
| `VITE_API_URL`              | app           | empty in dev (uses proxy)                 |
| `TEST_DATABASE_URL`         | tests         | defaults to `DATABASE_URL` with db `linear_test` |
| `PORT`, `LOG_LEVEL`         | api (+ worker log level) | `3000`, `info`                 |

All server env is validated with Zod at startup (`packages/env`); the process exits on invalid configuration. Only `VITE_`-prefixed variables reach the browser.

### 8.14 Local Development

- `docker compose up -d` starts PostgreSQL, Redis, and MinIO (with a one-shot job that creates the bucket).
- `bun install` at the root; `bun run dev` runs app, api, and worker in parallel through Turborepo.
- `bun run db:migrate` applies Drizzle migrations; `bun run db:seed` creates the demo workspace `Tip` with team `TIP`.
- GitHub webhooks reach a local API through a tunnel (cloudflared, ngrok); `bun run demo:github` simulates signed deliveries without GitHub (README → Demo script).
- `docker-compose.prod.yml` runs the whole stack from the production images (`Dockerfile` targets `server` and `app`).

Default ports: app `5173`, api `3000`, Postgres `5432`, Redis `6379`, MinIO API `9000`, MinIO console `9001`.

---

## 9. Non-Functional Requirements

### Performance

- Issue lists should load without noticeable unnecessary delays.
- Common issue updates should feel responsive.
- Database queries should be scoped to the correct workspace.
- Frequently filtered issue fields should have appropriate indexes.
- Slow or retryable work (webhook processing, image processing) runs in the worker, never in the request path.
- Route-level code splitting and virtualized long lists in the app.

### Security

- Secure authentication and session management.
- Server-side authorization on all protected operations.
- Secure password storage.
- Webhook signature verification.
- Private object storage with short-lived presigned URLs.
- Upload type and size validation on the server.
- Environment-based secret management.
- Minimal GitHub App permissions.
- No cross-workspace data leakage.

### Reliability

- No duplicate issue identifiers.
- No duplicated PR links.
- Repeatable webhook processing (BullMQ jobs keyed by delivery ID, retried with backoff).
- Safe handling of network failures.
- Status automation based on confirmed GitHub state.

### Accessibility

- Keyboard-accessible navigation.
- WCAG AA text contrast in both light and dark themes.
- Visible keyboard focus.
- Accessible form labels.
- Adequate text contrast.
- Clear error feedback.

### Maintainability

- TypeScript across application code.
- Modular backend services with shared domain logic in `packages/core`.
- Contract-first API (oRPC) shared between app and API.
- Database migrations (drizzle-kit), committed to the repository.
- Reusable UI components.
- Automated tests for issue creation and GitHub workflow rules.
- Consistent error handling.

---

## 10. Risks and Mitigations

| Risk                             | Impact                 | Mitigation                                         |
| -------------------------------- | ---------------------- | -------------------------------------------------- |
| Scope becomes too large          | Project unfinished     | Strict P0/P1/P2 separation                         |
| GitHub App setup becomes complex | Integration delays     | Prototype with a repository webhook first          |
| Monorepo/infra overhead          | Slow start             | Scaffold all apps + Docker Compose in Milestone 1  |
| Worker down / Redis unavailable  | Webhooks not processed | Deliveries persisted first; jobs retried on recovery |
| Duplicate webhooks               | Repeated updates       | Persist delivery IDs and use idempotent processing |
| Multiple PRs per issue           | Premature completion   | Explicit closing-link and merge evaluation rules   |
| Out-of-order events              | Incorrect PR status    | Reconcile current PR state                         |
| Workspace data leakage           | Security vulnerability | Verify workspace membership on every operation     |
| UI consumes development time     | Backend incomplete     | Build functional UI before advanced polish         |

---

## 11. Delivery Milestones

### Milestone 1 — Application Foundation

**Deliverables**

- Authentication.
- Workspace creation.
- Teams.
- Database schema.
- Basic application navigation.
- Turborepo with `apps/app`, `apps/api`, `apps/worker` and shared packages.
- Docker Compose with PostgreSQL, Redis, and MinIO.
- oRPC contract wired end to end; Better Auth sign-up/sign-in.
- Avatar upload through MinIO.

**Completion Criteria**

Users can authenticate and create an isolated workspace containing a team.

### Milestone 2 — Issue Management

**Deliverables**

- Issue CRUD.
- Unique issue identifiers.
- Statuses and priorities.
- Assignees.
- Labels.
- Comments.
- Issue list and detail views.

**Completion Criteria**

Users can manage issues through the full issue lifecycle.

### Milestone 3 — Projects and Views

**Deliverables**

- Project CRUD.
- Issues within projects.
- My Issues view.
- Board view.
- Search, filters, and sorting.

**Completion Criteria**

Users can organize and inspect project work efficiently.

### Milestone 4 — GitHub Integration

**Deliverables**

- Repository connection.
- Webhook receiver.
- Signature verification.
- PR identification and linking.
- PR state synchronization.
- Automatic status transitions.

**Completion Criteria**

A PR referencing `TIP-200` appears on the correct issue, and merging the PR automatically completes the issue according to the defined rules.

### Milestone 5 — Testing and Finalization

**Deliverables**

- Integration tests.
- Bug fixes.
- UI polish (verified in both themes).
- Setup documentation.
- School demonstration scenario.

**Completion Criteria**

All P0 requirements pass acceptance tests, and the end-to-end GitHub workflow can be demonstrated reliably.

---

## 12. Final Acceptance Test Plan

The project will be considered ready for submission when the following scenarios pass.

### Test 1 — Issue Creation

**Given** a team with the identifier TIP  
**When** a user creates a new issue  
**Then** the system generates a unique identifier such as `TIP-200`.

### Test 2 — Issue Editing

**Given** an existing issue  
**When** a user updates its priority, assignee, or status  
**Then** those values persist correctly.

### Test 3 — GitHub Linking

**Given** the issue `TIP-200` exists  
**When** a GitHub PR is opened from `tip-200-fix-login`  
**Then** the platform links the PR to `TIP-200`.

### Test 4 — Automatic In Progress

**Given** `TIP-200` is Todo  
**When** an eligible linked PR is opened  
**Then** the issue becomes In Progress.

### Test 5 — Automatic Completion

**Given** `TIP-200` has one required linked PR  
**When** that PR is merged  
**Then** the issue becomes Done.

### Test 6 — Closed Without Merge

**Given** an issue has an open linked PR  
**When** that PR is closed without merging  
**Then** the issue does not automatically become Done.

### Test 7 — Multiple PRs

**Given** an issue requires PR #42 and PR #43  
**When** only PR #42 merges  
**Then** the issue remains In Progress.

**When** PR #43 also merges  
**Then** the issue becomes Done.

### Test 8 — Duplicate Webhooks

**Given** a webhook delivery has already been processed  
**When** the identical delivery arrives again  
**Then** no duplicate PR associations or activity transitions are created.

### Test 9 — Cross-Workspace Protection

**Given** an issue belongs to another workspace  
**When** an unrelated repository sends a PR referencing that identifier  
**Then** the issue is not modified.

### Test 10 — End-to-End Demonstration

**Given** a functioning workspace and connected GitHub repository  
**When** a user creates an issue, opens a corresponding PR, and merges it  
**Then** the system displays the PR and updates the issue lifecycle without requiring manual synchronization.

---

## 13. Definition of Done

The MVP is complete when:

- All P0 functional requirements are implemented.
- Core issue-management operations work reliably.
- Workspaces and teams have correctly isolated data.
- Issue identifiers remain unique.
- Projects and issue views are functional.
- GitHub repositories can be connected.
- Pull requests link to corresponding issues.
- GitHub webhook events update PR information.
- Successful PR merges trigger valid issue completion.
- Closing a PR without merging never completes an issue.
- All critical acceptance tests pass.
- Installation, environment variables, Docker Compose services, and GitHub setup are documented.
- `bun run build`, `bun run lint`, `bun run typecheck`, and `bun run test` pass across the monorepo.
- The product can be demonstrated from issue creation through GitHub merge.

---

## 14. Final Product Objective

Deliver a working, developer-focused issue tracking application inspired by Linear that demonstrates real-world full-stack engineering capabilities.

The finished school project should demonstrate:

1. Modern Vue 3 + Vite frontend development in a Turborepo monorepo.
2. Relational database modeling.
3. Authentication and multi-tenant authorization.
4. Complete CRUD operations.
5. External API integration.
6. Webhook processing and verification.
7. Event-driven workflow automation.
8. Consistent product design.
9. Background job processing with BullMQ and Redis.
10. S3-compatible object storage with MinIO.
11. Type-safe, contract-first APIs with oRPC.
12. Automated testing and reliable deployment.

**The central outcome is a working connection between project planning and real GitHub development activity, demonstrated by automatically completing `TIP-200` when its required pull request is merged.**
