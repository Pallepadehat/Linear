# Domain

Exact rules behind PRD FR-02 – FR-14. If code and this doc disagree, one of them is a bug.

## Glossary

| Term              | Meaning                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Workspace         | Tenant boundary. Owns teams, projects, labels, members, GitHub installations, uploads.       |
| Member            | A user in a workspace with role `owner` or `member`.                                         |
| Team              | Group inside a workspace that owns issues and has a unique **key** (e.g. `TIP`).             |
| Issue             | Unit of work. Belongs to exactly one team (and therefore one workspace).                     |
| Identifier        | Human-readable issue ID: `{teamKey}-{number}`, e.g. `TIP-200`.                               |
| Workflow status   | A team's status (Backlog, Todo, …). Each status has a **category**.                          |
| Project           | Optional grouping of issues across a workspace.                                              |
| Installation      | A GitHub App installation connected to one workspace.                                        |
| Connected repo    | A GitHub repository from an installation, enabled for a workspace.                           |
| PR link           | Relationship between an issue and a pull request, of type `closing` or `reference`.          |
| Delivery          | One GitHub webhook delivery, identified by the `X-GitHub-Delivery` header.                   |
| Upload            | A file in MinIO with a DB record (`pending` → `ready` → `deleted`).                          |

## Roles

| Action                                              | Owner | Member |
| --------------------------------------------------- | :---: | :----: |
| Update workspace settings, icon                     |  ✅   |   ❌   |
| Invite / remove members, change roles               |  ✅   |   ❌   |
| Connect / disconnect GitHub installations and repos |  ✅   |   ❌   |
| Create / edit teams                                 |  ✅   |   ✅   |
| Create / edit / delete issues, projects, labels     |  ✅   |   ✅   |
| Comment; edit/delete own comments                   |  ✅   |   ✅   |
| Delete others' comments                             |  ✅   |   ❌   |

A workspace always has at least one owner. The last owner cannot leave or be demoted.

## Identifiers

- Workspace slug: `^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$` (2–40 chars, no leading/trailing dash), globally unique, lowercase. Reserved (collide with routes): `api`, `rpc`, `webhooks`, `health`, `login`, `register`, `setup`, `settings`.
- Workspaces are addressed by slug in URLs and in every workspace-scoped procedure input (`workspaceSlug`). Non-members get `NOT_FOUND`.
- Team key: `^[A-Z][A-Z0-9]{1,9}$` (2–10 chars), unique per workspace, stored uppercase. Changing a key is not supported in the MVP.
- Issue number: per-team counter, starts at 1, allocated atomically in the create transaction. Numbers are never reused, even after deletion.
- Identifier lookups are case-insensitive (`tip-200` → `TIP-200`).

## Statuses

Each team gets these defaults on creation:

| Status      | Category    | Default order |
| ----------- | ----------- | ------------- |
| Backlog     | `backlog`   | 0             |
| Todo        | `unstarted` | 1             |
| In Progress | `started`   | 2             |
| Done        | `completed` | 3             |
| Canceled    | `canceled`  | 4             |

- Logic (automation, filters, `completedAt`) uses **categories**, never status names.
- Entering `completed` sets `completedAt`; leaving it clears `completedAt`.
- New issues default to `Todo` unless another status is given. If the team has no status named `Todo`, the first `unstarted` status (by order) is used.

## Priorities

Stored as integers so they sort: `0` No priority, `1` Urgent, `2` High, `3` Medium, `4` Low. Sorting by priority puts Urgent first and No priority last.

## GitHub connection

- Only owners install the App and connect or disconnect repositories (see Roles); every `github.*` procedure checks this on the server.
- Install flow: `github.installUrl` → GitHub → callback `/setup/github?installation_id&state&code` → `github.completeInstall`. The `state` is signed, expires after 10 minutes, and must belong to the user completing the install. The installation is only stored if the authorizing GitHub user can access it (ADR 0009).
- An installation belongs to one workspace. Completing an install for an installation owned by another workspace → `CONFLICT`; re-installing in the same workspace just refreshes the account name.
- The available repositories come live from GitHub (the installation's accessible repos). Only those can be connected. A repository connected to another workspace → `CONFLICT`; connecting it again in the same workspace is a no-op.
- Connected repositories stay listed even if GitHub no longer reports them (App uninstalled or access revoked), so they can still be disconnected.
- Disconnecting deletes the repository's pull requests and issue links (FK cascade); issue statuses are not changed.
- Without the `GITHUB_APP_*` env vars the integration is off: the list shows existing connections only and install/connect return `BAD_REQUEST`.

## GitHub PR linking

### Detection sources and link types

| Source                      | Example                          | Link type   |
| --------------------------- | -------------------------------- | ----------- |
| Branch name                 | `tip-200-fix-login`, `feat/tip-200` | `closing` |
| PR title                    | `TIP-200 Fix login validation`   | `closing`   |
| Body: `fixes`, `closes`, `resolves` (+ `fix`, `close`, `resolve`, `fixed`, `closed`, `resolved`) | `Fixes TIP-200` | `closing` |
| Body: `refs`, `ref`, `related to`, `part of` | `Refs TIP-200`     | `reference` |
| Body: bare identifier       | `see TIP-200`                    | `reference` |

- Matching is case-insensitive. Pattern: `\b([A-Za-z][A-Za-z0-9]{1,9})-(\d+)\b`.
- Branch matching uses each `/`-separated segment: `^([a-z][a-z0-9]{1,9})-(\d+)(?:-|$)`.
- If the same issue is detected as both `closing` and `reference`, `closing` wins.
- A body keyword applies only to the identifier directly after it (optionally followed by `:`), e.g. `Fixes TIP-1, TIP-2` closes `TIP-1` and references `TIP-2`. Keywords inside other words (`prefixes`, `unclosed`) don't count.
- Numbers are normalized (`TIP-0200` = `TIP-200`); `0` is never a valid issue number.
- The parser (`parsePrIdentifiers` in `packages/core/src/github`) returns candidates only. Branch segments must *start* with the identifier, so `fix-utf-8` is ignored, but text like `utf-8` in a title still yields a `UTF-8` candidate; the team-key lookup below discards it.
- A candidate is linked only if the team key exists **in the workspace that owns the repository** and the issue number exists. Everything else is ignored silently.
- On `edited` / `synchronize`, links are recomputed: new ones added, ones that no longer appear removed (unless the PR is already merged — merged links are frozen).
- Unique: one link per `(issueId, pullRequestId)`.

### Persistence

- GitHub numeric IDs are stored as PostgreSQL `bigint`; internal relationships use UUIDs. A repository's `installationId` references `github_installations.id`, not the external GitHub installation ID.
- Issue–PR links carry `workspaceId` like other workspace-owned rows. Callers must validate that the issue, PR, repository, and installation belong to the same workspace.
- Webhook deliveries are global ingress records, including ignored events from unconnected installations; they do not have a workspace owner.

### PR state

Stored state is one of `open`, `draft`, `closed`, `merged`. `merged` is terminal: no later event may move it back. "Merged" is determined by GitHub's `merged` flag, never by `closed` alone.

## Automation

Automation only moves issues **forward** and never touches `completed` or `canceled` issues. Every automated change writes an `ActivityLog` entry with actor `github` and the PR reference.

| Trigger                                    | Condition on issue                       | Result                         | PRD rule |
| ------------------------------------------ | ---------------------------------------- | ------------------------------ | -------- |
| Closing link created on an `open`/`draft` PR | Category `backlog` or `unstarted`      | → first `started` status (In Progress) | A |
| PR merged                                  | Category not `completed`/`canceled` and **all required PRs merged** | → first `completed` status (Done) | B, C |
| PR closed without merge                    | any                                      | No status change               | E |
| Reference link created / PR merged         | any                                      | No status change               | D |
| User changes status manually               | any                                      | Manual value wins; automation never reverts it | F |

**Required PRs** for an issue = its `closing` links whose PR is not `closed` (closed-without-merge PRs stop being required). The issue completes when the required set is non-empty and every PR in it is `merged`.

Automation is a pure function in `packages/core/src/automation`:

```ts
evaluate(issue: { category: StatusCategory }, links: { type: LinkType; prState: PRState }[], event: AutomationEvent)
  → { to: 'started' | 'completed' } | null
```

`AutomationEvent` identifies the triggering relationship with `linkType` (`closing` or
`reference`). Events are `{ type: 'link_created', linkType, prState }`,
`{ type: 'pr_merged', linkType }`, or `{ type: 'pr_closed', linkType }` (closed
without merge). The worker supplies the current issue category and all links
**after** reconciling PR state and link changes. A reference event never moves an
issue, even if existing closing links are all merged. Closing a PR without merge
does not trigger completion; a subsequent closing-PR merge may complete the issue
with that closed PR excluded from the required set.

## Webhook processing

1. Verify `X-Hub-Signature-256` (HMAC-SHA256 of the raw body). Invalid → `401`, nothing stored.
2. Insert `WebhookDelivery` (unique delivery ID). Already exists → `200`, nothing enqueued.
3. Enqueue `github-webhooks` job with `jobId = deliveryId` → `202`.
4. Worker: upsert PR, recompute links, reconcile current PR state from GitHub when in doubt, run automation in one transaction, mark delivery `processed` (or `failed` with error).

Only `pull_request` events are handled in the MVP; others are stored and marked `ignored` (HTTP `200`, no job). The endpoint fails closed (`401`) when no webhook secret is configured. After signature verification, malformed JSON, non-object payloads, or missing/invalid delivery UUID or event headers return `400` without persistence.

## Uploads

| Kind               | Owner      | Formats                          | Max   |
| ------------------ | ---------- | -------------------------------- | ----- |
| `avatar`           | user       | png, jpeg, webp                  | 2 MB  |
| `workspace_icon`   | workspace  | png, jpeg, webp, svg (sanitized) | 1 MB  |
| `project_icon`     | workspace  | png, jpeg, webp, svg (sanitized) | 1 MB  |
| `attachment` (P1)  | workspace  | images, pdf, txt, zip            | 25 MB |

SVG icons are rejected until server-side sanitization exists; until then icons accept png, jpeg, webp only.

Lifecycle: `pending` (presigned, not confirmed) → `ready` (confirmed, processing enqueued) → `deleted` (object removal enqueued). Pending uploads older than 24 h are deleted by the maintenance job. Image variants: `original`, `256` (avatars/icons also `64`).

## Issues

- Any member may create, edit and delete issues. Deleting is permanent (labels and PR links cascade).
- An update only changes the fields it sends; `labelIds` replaces the whole label set. Every update bumps `updatedAt`, including labels-only changes.
- Status, assignee, labels and project are validated against the issue's team / workspace: a status from another team, a non-member assignee, or a label or project outside the workspace is `BAD_REQUEST`. An issue id from another workspace is `NOT_FOUND`.
- Until projects exist (M3-01), any non-null `projectId` is `BAD_REQUEST`.
- `issues.list` returns newest first, optionally filtered by team, as `{ items, nextCursor }`. The cursor is the last issue's id: UUIDv7 ids are time-ordered, so issues created later never shift the pages after a cursor. Page size defaults to 50 (max 100).

## Activity

- Every issue change is logged in `activity_log`, in the same transaction as the change: `created` on create, then one entry per field whose value actually changed. Setting a field to the value it already had (including the same label set in another order, or a title that trims to the current one) writes nothing.
- Actor is `user` (with `actorId`) for changes made through the API, `github` (no `actorId`) for automation. A deleted user's entries keep `actorType: user` with `actorId` null.
- `from`/`to` per kind: `title` text; `status`, `assignee`, `project` ids (or null); `priority` number; `labels` sorted label-id arrays. Ids are stored rather than names, so renamed statuses and labels show their current names. `created` and `description` carry no values (description text is not copied into the log).
- `activity.list` returns one issue's entries **oldest first** as `{ items, nextCursor }`, cursor = last entry id (UUIDv7), page size 50 (max 100). An issue outside the workspace is `NOT_FOUND`.

## Labels

- Labels are workspace-wide (shared by all teams). Any member may create, rename, recolor or delete them.
- Names are trimmed, 1–80 characters, and unique per workspace (exact match, so `Bug` and `bug` can coexist); a duplicate is `CONFLICT`.
- Colors are stored as lowercase `#rrggbb`. They are user data rendered as-is, not design tokens.
- Deleting a label removes it from every issue (`issue_labels` cascades).

## Isolation invariants

- Every workspace-owned row has `workspaceId`; every query filters on it.
- An issue's `workspaceId` equals its team's `workspaceId`.
- A project, label, or assignee attached to an issue must belong to the same workspace (assignee must be a member).
- A GitHub repository belongs to exactly one workspace at a time.

## Users

- New teams add their creator as the first team member.
- Avatars are user-owned uploads; they are visible to the user and to anyone who shares a workspace with them. Replacing or removing an avatar marks the old upload `deleted` and enqueues object removal.
- A user with no workspace is sent to workspace setup after sign-in.
