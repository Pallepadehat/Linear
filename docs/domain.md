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
| Change team issue defaults                          |  ✅   |   ❌   |
| Change team cycle settings                          |  ✅   |   ❌   |
| View cycles, rename a cycle, move issues in/out     |  ✅   |   ✅   |
| Create / edit / delete issues, projects, labels     |  ✅   |   ✅   |
| Add / edit / remove issue links                     |  ✅   |   ✅   |
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
- New issues get the team's default status (see Team issue defaults) unless another status is given.

## Team issue defaults

Each team stores the defaults used when an issue is created without that field (team settings page → Issue defaults; `teams.update`, owner-only):

| Field             | Column                | On team creation |
| ----------------- | --------------------- | ---------------- |
| Status            | `default_status_id`   | `Backlog`        |
| Priority          | `default_priority`    | `0` No priority  |
| Assignee          | `default_assignee_id` | none             |

- The default status must belong to the same team (composite FK `teams_default_status_fk`). While it is someone's default, a status can't be deleted.
- Fallback rule when no default status is stored: `Backlog` by name, else the first `backlog` status (by order), else the first `unstarted` one (`pickDefaultStatus` in `packages/core/src/teams`). Migration 0009 backfilled existing teams with this rule. `teams.get` returns the resolved status, so the app never needs the rule.
- Omitted fields in `issues.create` use the defaults; explicit values win. `assigneeId: null` means unassigned even with a default assignee.
- A default assignee who is no longer a workspace member is skipped (the issue is unassigned), not an error. Setting a non-member, or another team's status, as default → `BAD_REQUEST`. Deleting the user clears the default.
- The create dialog preselects the picked team's defaults; switching team re-applies them for fields not picked by hand.

## Priorities

Stored as integers so they sort: `0` No priority, `1` Urgent, `2` High, `3` Medium, `4` Low. Sorting by priority puts Urgent first and No priority last.

## Estimates

- Each team picks an estimate scale (`teams.estimate_scale`, owner-only like other team settings): `off` (default, estimates hidden), `linear` 1–5, `fibonacci` 1, 2, 3, 5, 8, `exponential` 1, 2, 4, 8, 16, `tshirt` XS, S, M, L, XL stored as 1, 2, 3, 5, 8 so they sum like points.
- `teams.estimate_allow_zero` (default off) adds `0` to any scale; Fibonacci's 0 follows the same flag. A t-shirt `0` is shown as the raw number "0".
- `issues.estimate` is a nullable integer (`null` = no estimate, DB check 0–100). Create and update accept a value only if it is on the issue team's current scale (`BAD_REQUEST` otherwise, and for any value while the scale is `off`); `null` (clear) is always allowed.
- Changing the scale or the zero flag keeps existing estimates; the UI shows a value that is no longer on the scale as its raw number. Only a *changed* estimate is validated, so editing other fields of such an issue still works.
- `issues.list` filter `estimates`: specific values, `null` = no estimate, `'any'` = has an estimate (OR'd). Sort `estimate`: `desc` largest first, `asc` smallest first, no estimate last in both directions, newest first within a value.
- Activity kind `estimate` with numeric `from`/`to` (null when unset); the timeline reads "set estimate to 3 points" / "removed estimate" (t-shirt teams name the size).
- Group headers and board columns show the sum of their issues' estimates, counting only issues whose team uses estimates; hidden when the sum is 0.
- `E` opens the estimate picker on the issue page, in the create dialog, and on the focused list row or board card (compact pickers answer their hotkey while focus is inside their row).

## Due dates

- An issue's `dueDate` is a calendar day (`YYYY-MM-DD`, Postgres `date`), with no time and no timezone; null = no due date. `issues.create` / `issues.update` take it (null clears it); anything that isn't a real day (`2026-02-30`, a timestamp) is `BAD_REQUEST`. Changes are logged as activity kind `due_date` (`from`/`to` = the days) and published as `issue.updated` with field `dueDate`.
- **Today** is always the viewer's local day. The server never guesses a timezone: the relative list filters need `today` from the client (the app sends the browser's local date) and are `BAD_REQUEST` without it.
- **Weeks** run Monday–Sunday. "End of this week" is that Sunday (on a Sunday it is today).
- **Overdue:** due before today and the status category isn't `completed` or `canceled`. **Due soon:** due today through 2 days ahead (same exclusion). Finished issues show their date in the neutral color.
- `issues.list` filter `due` (any of): `overdue`; `dueThisWeek` = due from today through Sunday (any status); `noDueDate`. In the URL: `?due=overdue,dueThisWeek,noDueDate`. Sort `dueDate`: `asc` soonest first, `desc` latest first; no due date is last in both directions (keyset as `±infinity`); ties break by id in the sort's direction.
- UI: `⇧D` opens the due date picker on the detail page, in the create dialog, and on a list row while focus is in that row (row pickers' hotkeys are scoped to the focused row). Shortcuts Today / Tomorrow / End of this week / In one week (digits 1–4), then Custom… (calendar, Monday first), and Remove due date when one is set. The row chip shows the short date ("Nov 7", with the year when it isn't this year) only when set: `priority-urgent` when overdue, `status-started` when due soon, neutral otherwise, with a "Due in 3 days" / "Overdue by 2 days" tooltip. Timeline: "set due date to Nov 7" / "removed due date".

## GitHub connection

- Only owners install the App and connect or disconnect repositories (see Roles); every `github.*` procedure checks this on the server, except `github.pullRequests.listForIssue`, which any member may call.
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

### Linked PRs on an issue

- `github.pullRequests.listForIssue` returns every PR linked to the issue as `{ id, number, title, url, repoFullName, state, linkType, updatedAt }`, most recently updated first. It is a plain array: an issue links to a handful of PRs. An issue outside the caller's workspace is `NOT_FOUND`.
- A PR linked through both a `reference` and a `closing` mention has one link, of type `closing` (links are unique per issue and PR), so it is listed once.
- Displayed states: Open, Draft, Merged, Closed (closed without merge). Link types read "Closes" (`closing`) and "References" (`reference`). Rows open the PR on GitHub in a new tab.
- GitHub activity entries link to their PR (`repo#number`) while it is still linked; once unlinked or removed they read without the link.
- A `pullRequests` realtime field on `issue.updated` refetches the issue's PR list.

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

Worker details (`processPullRequestDelivery` in `packages/core/src/github`):

- Handled actions: `opened`, `edited`, `synchronize`, `reopened`, `ready_for_review`, `converted_to_draft`, `closed`. Other actions and repositories that aren't connected mark the delivery `ignored`. A payload missing the fields we need is marked `failed` and not retried.
- Deliveries already `processed` or `ignored` are skipped, so a retry or redelivery has one effect. An unexpected error rolls the transaction back, marks the delivery `failed` and rethrows so BullMQ retries.
- Once a PR is `merged`, later events change nothing about it (state, metadata, links).
- Events per linked issue: each new link → `link_created` (a `reference` link upgraded to `closing` counts as a new closing link); the PR becoming merged in this delivery → `pr_merged` for every link. Closing without merge isn't evaluated (rule E never moves an issue). Results move the issue to the team's first status (by position) of that category, through `updateIssue` with actor `github`, so the activity entry carries `pullRequestId`.
- Late out-of-order events between non-merged states (e.g. a stale `opened` after `closed`) still overwrite the stored state; reconciling against GitHub's API is a follow-up.

Only `pull_request` events are handled in the MVP; others are stored and marked `ignored` (HTTP `200`, no job). The endpoint fails closed (`401`) when no webhook secret is configured. After signature verification, malformed JSON, non-object payloads, or missing/invalid delivery UUID or event headers return `400` without persistence.

## Uploads

| Kind               | Owner      | Formats                          | Max   |
| ------------------ | ---------- | -------------------------------- | ----- |
| `avatar`           | user       | png, jpeg, webp                  | 2 MB  |
| `workspace_icon`   | workspace  | png, jpeg, webp, svg (sanitized) | 1 MB  |
| `project_icon`     | workspace  | png, jpeg, webp, svg (sanitized) | 1 MB  |
| `attachment`       | workspace  | png, jpeg, webp, gif, pdf, txt, zip | 25 MB |

SVG icons are rejected until server-side sanitization exists; until then icons accept png, jpeg, webp only. SVG and HTML are never accepted as attachments.

Attachments: any workspace member may upload one. They are embedded in markdown as `attachment:<uploadId>` (images as `![name](attachment:…)`, other files as `[name](attachment:…)`), never as a URL: every read resolves a fresh presigned GET through `uploads.getUrl`, which checks workspace membership. Attachments get no image variants (the original is served).

Attachment links (`issue_attachments`): every write of an issue description (`issues.create`, and `issues.update` when `description` is sent) parses the `attachment:` link destinations and replaces the issue's link set with them. Each referenced id must be a `ready` `attachment` upload in the issue's workspace, otherwise the write is `BAD_REQUEST` (an upload from another workspace, a pending upload, an icon or an unknown id all count). Ids in prose or code that aren't a link destination are ignored. One upload may be linked from several issues (e.g. a copied description).

- Deleting an issue marks each of its attachments `deleted` and enqueues `delete-objects`, unless another issue still links it.
- Removing a reference only unlinks the upload; it is not deleted right away, so an undo after an autosave can restore it. Unlinking (and every write that references it) bumps the upload's `updatedAt`.
- The hourly `cleanup-attachments` maintenance job deletes `ready` attachments that no issue links and that were untouched for 24 h: files uploaded in a dialog that was then closed, and references removed more than a day ago.
- Comment attachments aren't supported yet; when they are, the comment needs its own links before the sweep would spare its files.

Lifecycle: `pending` (presigned, not confirmed) → `ready` (confirmed, processing enqueued) → `deleted` (object removal enqueued). Pending uploads older than 24 h are deleted by the maintenance job. Image variants: `original`, `256` (avatars/icons also `64`).

## Issues

- Any member may create, edit and delete issues. Deleting is permanent (labels and PR links cascade).
- An update only changes the fields it sends; `labelIds` replaces the whole label set. Every update bumps `updatedAt`, including labels-only changes.
- Status, assignee, labels and project are validated against the issue's team / workspace: a status from another team, a non-member assignee, or a label or project outside the workspace is `BAD_REQUEST`. An issue id from another workspace is `NOT_FOUND`.
- Projects default to `planned`; team links are optional and restricted to the same workspace. Updates replace team links only when `teamIds` is supplied. Icons must be ready `project_icon` uploads in the same workspace. Project progress counts all linked issues, with only the `completed` status category in the numerator (canceled issues remain in the total). Deleting a project clears issue project references.
- Every project DTO (list, get, create, update) carries `progress` and a short-lived `iconUrl` (null until the icon is processed), so the projects table needs no per-row requests. Project names and descriptions are edited in place on the project page: the name saves on blur or Enter (Esc reverts), the description on blur; status, teams and icon save immediately, optimistically with rollback.
- Project properties (M9-01): `priority` uses the issue scale (0 No priority … 4 Low; a DB check enforces 0–4); `leadId` is optional and must be a workspace member (a deleted user clears it); `memberIds` are workspace members; `startDate` / `targetDate` are calendar days (`YYYY-MM-DD`, day resolution only, no time zone) and, when both are set, start ≤ target — an update is checked against the stored date it leaves unchanged, and a violation is `BAD_REQUEST`. A lead, member or project label from another workspace is `NOT_FOUND` (like a missing id). `memberIds` and `labelIds` replace their whole set only when supplied; duplicates collapse. The lead is not automatically a member.
- Project labels are a workspace-wide set of their own (`project_labels`), separate from issue labels, with the same name/color rules as issue labels (trimmed, unique per workspace → `CONFLICT`, lowercase `#rrggbb`). Any member may list and create them; the project labels picker creates one from the typed name with a default color. Renaming, recoloring and deleting project labels is not part of M9-01.
- Every project DTO also carries `issueCount` (all linked issues, the same number as `progress.total`).
- The projects page is a table: Name, Health (placeholder until project updates, M9-04), Priority, Lead, Target date, Issues, Status (icon + completed %). Clicking a header sorts by it ascending, again for descending; empty values (no priority, lead or target date) stay last in both directions and ties fall back to the name. The sort is a per-browser preference (`project-sort` in localStorage via the Pinia preferences store); the toolbar's status filter is transient UI state in Pinia. Priority, lead and target date are edited in the row; all properties are edited on the project page and in the create dialog, optimistically with rollback and a toast.
- The create issue dialog preselects the project when opened from a project page. Until the issue detail page exists (M2-08), the project picker lives in the create issue dialog; M2-08 reuses `ProjectPicker` in its properties sidebar.
- The issue detail page lives at `/:workspaceSlug/issue/:identifier`; the identifier is case-insensitive (`tip-200` opens TIP-200). An unknown or malformed identifier, or an issue in another workspace, shows the same "Issue not found" state. Clicking a list row opens it (the title is a link stretched over the row; the row's pickers sit above it).
- On the detail page, sidebar property changes save immediately through the same `useUpdateIssue()` mutation as the list rows (its patch also covers title, description and project; every settled change also refetches project progress). The title saves on blur or Enter (Esc reverts); the description uses the same markdown editor as the create dialog (rather than a plain textarea, so stored markdown and attachments render) and saves when focus leaves it, or once pending uploads finish, or when leaving the page.
- The detail timeline merges comments and activity oldest first. Activity names are resolved from current statuses, members, labels and projects; ids that no longer exist read as "a removed status/user/label/project". GitHub entries read as "GitHub". Comment bodies show as plain text for now; editing and deleting comments in the UI is not part of M2-08.
- `issues.list` returns `{ items, nextCursor }`, page size 50 by default (max 100). `teamId` / `projectId` are the page's scope; the user's filters are multi-value lists: `statusIds`, `priorities`, `assigneeIds` and `projectIds` (`null` in the list = unassigned / no project) and `labelIds` (issues with **any** of the labels). Values within one filter are OR, different filters AND; an empty list doesn't filter; ids from elsewhere match nothing.
- `q` matches the title case-insensitively as a literal substring (`%` and `_` aren't wildcards), **or** an exact identifier like `tip-12` (case-insensitive, same team key + number). No full-text or trigram index yet: the title match is a scan within the workspace, fine at P0 sizes.
- Sorts: `createdAt` (default), `updatedAt`, `priority`; `direction` `desc` (default) is newest / most urgent first, `asc` the reverse. Priority sorts Urgent → Low for `desc` and Low → Urgent for `asc`; No priority is last in both. Ties break by id, newest first for priority and in the sort's direction for dates.
- Pagination is keyset: the cursor is opaque (base64url of the sort, the last row's sort value and its id). Timestamps travel as epoch microseconds computed in Postgres so no row is skipped or repeated at millisecond ties. A cursor issued for another sort or direction is `BAD_REQUEST`. Issues inserted or edited elsewhere in the order never shift the pages after a cursor.
- The list and board views store filters and search in the route query so reloads and shared links restore the view: `?status=<ids>&priority=1,2&assignee=<ids|none>&project=<ids|none>&label=<ids>&q=…` (comma-separated; defaults omitted; malformed values are dropped, not errors). Updates replace the history entry. Search applies 250 ms after typing stops. Statuses are per team, so the workspace-wide filter merges same-named statuses (each team's `Todo`) into one option that selects all their ids; `teams.list` returns each team's statuses for this. A project page hides the project filter. Scope params (`assignee: 'me'`, `creator: 'me'`, `teamId`, `projectId`) combine with the filters by AND.
- My Issues (the workspace landing page) lists issues in the current workspace across all teams, with two tabs: **Assigned** (default, `issues.list` with `assignee: 'me'`) and **Created** (`creator: 'me'`). `'me'` is resolved to the session user on the server, so a client can't list another user's issues this way. The active tab is in the URL (`?tab=created`; Assigned has no param). The empty state's "Create issue" opens the create dialog, preassigned to the current user from the Assigned tab.
- Issue view tabs (team issues and All issues pages): **All issues** (default, no category filter), **Active** (`started` + `unstarted`) and **Backlog** (`backlog`), in Linear's order. Completed and canceled issues show only under All issues. The tab is `?view=active|backlog` (All issues has no param; unknown values fall back to All issues), sent to `issues.list` as `statusCategories`, which combines with `statusIds` and every other filter by AND (an empty list doesn't filter). Switching tabs **pushes** a history entry (back/forward walks the tabs) and keeps the filter params; Clear filters keeps the tab. No counts on the tabs. My Issues keeps its own Assigned / Created tabs and has no view tabs; project pages have none. On the board, a tab hides the empty columns of other categories (an issue just moved out keeps its column until the list refetches). A teammate's status change refetches tabbed lists, since it can move an issue between tabs.
- Details panel (`⌘I`, Ctrl+I elsewhere; team issues and All issues pages): counts of the issues the list shows, by **Assignees**, **Labels**, **Priority** and **Projects** (`issues.facets`, same scope, view tab and filters as `issues.list`; sort doesn't matter). Unassigned and project-less issues are a "No assignee" / "No project" row; an issue with several labels counts once under each, so label counts can add up to more than the list. Rows are sorted by count, most first (on a tie the `null` row comes last). Clicking a row toggles that value in the URL filter, like the filter menu; a filtered value with no matching issues stays listed at 0 so it can be switched off there. Open/closed is remembered per browser for each team (or the workspace) and view tab. A team, project or cycle scope from another workspace is `NOT_FOUND`. Counts refresh on issue creates, deletes and changes to assignee, labels, priority, project, status or title, including a teammate's (realtime).
- **Filter menu and operators (M7-06).** `F` (or the toolbar's Filter button) opens a searchable "Add Filter…" popover on the `floating` surface: dimensions in Linear's order (Status, Assignee, Creator, Priority, Labels, Dates ›, Project, Milestone, Cycle, Estimate, Due date, Subscribers, Content, Links). Typing at the top level also lists matching values across the multi-value dimensions ("Status › Todo"). ↵ opens a dimension's page in place; on it ↵ toggles a value (multi-value pages stay open, single-value ones such as dates and links close); Backspace or ← in an empty search goes back; Esc closes. Dates › Created / Updated / Completed offer Past day (24 h), Past week (7 days), Past month and Past 3 months (calendar months back from now), plus Before… / After… with a calendar. Content filters title or description (case-insensitive substring; applied with ↵). Links offers Has / No links (`hasLinks`: web links or linked PRs) and Has / No pull requests (`hasPullRequests`).
- Chips read `<dimension> <operator> <values>`: one value by name, several as a count ("3 labels"). Clicking the operator cycles **is → is not** (several values: "is any of" / "is none of"); labels cycle **is any of → include all of → is not**. × removes the chip. Status, priority, assignee, project, creator and labels have operators; milestone (offered on a project page, or when the project filter is "is" one project), cycle, estimate, due date and subscribers are always "is". Dates read "after Oct 1, 2026", "before …" or "in the past week"; content "contains “…”".
- API semantics: `…Not` lists leave out issues with any of the values; on nullable properties (assignee, project) an excluded value keeps issues without one ("assignee is not Ada" includes unassigned), and `null` in the list excludes those. `labelMode: 'all'` needs every listed label. Date bounds: `createdAfter` / `updatedAfter` / `completedSince` inclusive, `…Before` exclusive; only completed issues have `completedAt`, so the Completed date filter leaves out open issues. It is `completedSince`, not `completedAfter`: that one belongs to the **Completed issues** display option and keeps open issues; when both are set they combine by AND. "Before/after a day" means the viewer's local midnight of that day, and "past …" windows are computed on the client from its clock (rounded to the minute), so the server never guesses a timezone. `creatorIds` / `creatorIdsNot` take `me` like subscribers. Ids from another workspace match nothing.
- URL (the filters own exactly these keys; clearing a filter drops its key, other params such as `?view=` stay): the operator lives in the key: `?status=` (is), `?status-not=`, `?label-all=`, `?label-not=` (also `priority-`, `assignee-`, `project-`, `creator-`); if both `?x=` and `?x-not=` are present, `?x=` wins. `?creator=<ids|me>`, `?created=past-day|past-week|past-month|past-3months|before-YYYY-MM-DD|after-YYYY-MM-DD` (likewise `updated`, `completed`), `?content=…`, `?pr=yes|no`, `?links=has|none`. Malformed values are dropped.
- The view toolbar (under the page header) holds the tabs on the left and round icon buttons on the right: Filter (`F`, opens the filter menu; ignored while typing), Display options (see below) and Details (`⌘ I`, opens the Details panel above). Filter chips and search stay in the filter bar below it; pages without the toolbar (My issues, project, cycle) show the Display options button at the end of the filter bar.
- Descriptions are stored as **markdown** (CommonMark + GFM task lists) with Linear's extensions: `+++ Title … +++` collapsible sections, `$$ … $$` LaTeX blocks, ```` ```mermaid ```` diagrams and `attachment:` references (see Uploads). The editor reads and writes markdown; an empty editor saves no description (`null`). An issue can't be submitted while attachments are still uploading.
- The issue list groups loaded issues by the view's grouping (default Status). Status groups are keyed by category + name so the workspace-wide list merges each team's `Todo` into one group, and are ordered `started`, `unstarted`, `backlog`, `completed`, `canceled`, then by status position; issues keep the list's sort order within a group. Group counts show loaded issues until every page is fetched (the next page loads on scroll).
- **Display options** (sliders button, `IssueDisplayOptions`): one set per view, keyed `team:<id>`, `project:<id>`, `cycle:<id>`, `my` or `all`, kept in the Pinia preferences store (`issue-display-options` in localStorage; parsed field by field on read, so a stale value only resets that field). "Reset" drops the view's entry. The shape is `displayOptionsSchema` in `packages/contract` (saved views, M10-05, reuse it). Defaults: List, grouped by Status ascending, no sub-grouping, ordered by Created newest first, completed issues All, sub-issues shown, empty groups hidden, every property on except Updated.
  - **Layout** List | Board (team and All issues pages; My issues, project and cycle pages stay list-only).
  - **Grouping** Status, Assignee (members A → Z), Priority (Urgent → Low), Project (A → Z), Label (A → Z; an issue is in each of its labels' groups and is visited once by J/K and prev/next) or No grouping (no headers). The direction toggle reverses the order; **No assignee / No priority / No project / No labels always stay last.** Grouping runs in the app over the loaded pages; the server never groups.
  - **Sub-grouping** (list only): the same choices inside each group, never the grouping itself, and only for groups with issues. Sub-group headers are indented under their group and collapse on their own.
  - **Ordering** Priority, Updated, Created, Due date, Estimate (Manual later) + direction: the server sort (`sort` / `direction`). **Order completed by recency** puts a group's completed and canceled issues after its open ones, most recently finished first.
  - **Completed issues** All, Past day / week / month (`completedAfter` = now minus 1 day / 7 days / 1 calendar month, rounded down to the minute so the query key stays stable) or None (`statusCategories` without `completed` / `canceled`, intersected with a view tab's categories). `issues.list` with `completedAfter` keeps open issues and only those completed / canceled issues that finished at or after it: `completedAt`, or for canceled issues (which have no `completedAt`) their `updatedAt`. The Details panel's counts (`issues.facets`) use the same completed-issue and sub-issue options as the list beside it.
  - **Show sub-issues** (`showSubIssues`) and **Show empty groups**: every status of the loaded teams (within the visible categories), every priority, member, project or label, plus the "No …" group. On the board, status columns are always all shown (they are drop targets); other groupings show empty columns only with this switch ("Show empty columns").
  - **Display properties** toggle chips: ID, Status, Assignee, Priority, Project, Due date, Milestone, Labels, Links, Estimate, Created, Updated, Pull requests. Rows and cards hide the ones turned off. The cycle, sub-issue progress and blocked / blocking chips aren't display properties yet and always show when set.
- **Issue rows** (M7-04): left, priority, mono identifier, status and title; right, a chip group in this order: sub-issue progress, blocked by (red) / blocking counts, labels, project, milestone, cycle, pull requests, links, due date, estimate; then the assignee (dashed avatar when unassigned) and the Updated / Created dates (short, full date and time on hover). The title keeps at least 8rem; when the row is narrower, the chip group clips from its start edge, so the chips nearest the assignee stay visible. Rows stay 36px.
  - Every issue DTO (`issues.list`, `get`, `create`, `update`, `bulkUpdate`) carries `project: { id, name, iconUploadId } | null`, `milestone: { id, name } | null`, `pullRequests: { number, state }[]` and `linkCount` (web links only). The list loads them in batches for the page's issue IDs (one query each, workspace-scoped), never per row. The project chip's icon and name come from the workspace projects list (so an optimistic project change shows at once), falling back to the issue's own summary. The milestone chip is read-only and shows the server's summary, so after an optimistic change it appears with the response; any summary whose id no longer matches `projectId` / `milestoneId` is dropped from the cache.
  - Pull requests are ordered open and draft first, then merged, then closed, newest (highest number) first within each; the chip shows the first one's state icon and `#number`, plus `+n` for the rest (all listed in its tooltip). `draft` stays its own state (the contract's `pullRequestStateSchema`) rather than being folded into `open`.
  - Project and labels are pickers on the row; milestone, PR, links, blocked and date chips are read-only and open the issue like the rest of the row. Realtime PR and link events refetch the issue, so the chips stay current.
- Status, priority, assignee and labels change in place from issue rows through one `useUpdateIssue()` mutation: the change is written to every cached copy of the issue (each loaded list page and the `get`/`getByIdentifier` detail entries) before the request, rolled back with a toast if it fails, and the lists, details and activity are refetched once the last in-flight change settles. Changing status moves the row to its new group immediately; entering `completed` sets `completedAt` optimistically (cleared when leaving it). A row's status picker offers its own team's statuses. Row pickers' hotkeys only act on the row that has focus (a global key couldn't tell rows apart) and show labels only when the issue has some; adding the first label waits for the detail page (M2-08), which reuses the same mutation.
- The team and All issues pages switch between **List** and **Board** in Display options; the layout is part of the view's display options (per view key). My Issues, project and cycle pages stay list-only.
- The board has one column per group of the view's grouping (sub-grouping is list-only). Grouped by status, it has one column per status in workflow order (`backlog`, `unstarted`, `started`, `completed`, `canceled`, then position), keyed by category + name like the list groups, so the All issues board merges each team's `Todo`. Every status of the loaded teams gets a column, empty ones included; a team board waits for its statuses before rendering. Cards keep the list's sort order; the board has the same filter bar as the list. The board loads every page in the background (columns are only complete once all pages are in) and virtualizes each column.
- Dropping a card on a status column moves the issue to its **own team's** status with that column's category + name; on a priority, assignee or project column it sets that field (label and No grouping columns take no drops), through the same optimistic `useUpdateIssue()` (rollback + toast on error). A column the dragged issue's team has no status for doesn't accept the drop; dropping on the current column does nothing. The keyboard alternative is the card's status picker (Tab to it, Enter, pick the status), which offers the issue team's statuses.

- **Assignee picker** (one shared `AssigneePicker` in the create dialog, issue detail, list rows and board cards): rows are **No assignee** (`0`), the current user (`1`), then a **Team members** section with everyone else sorted by name (`2`–`9` for the first eight). Teams have no separate membership: every workspace member belongs to every team, so the team's members are `workspaces.listMembers` and no `teamId` input is needed. The filter matches name and email (case-insensitive); digits pick a row only while the filter is empty. Rows keep the shared 32px picker height and "Assign to..." placeholder from `design.md` (it wins over the issue's 28px).
- **Issue detail header** (M7-07): breadcrumb `Team › Issues › TIP-200 Title`; "Issues" links back to the list the issue was opened from (with its filters), else the team's issues page.
- **Prev/next** (`issueNav` Pinia store): clicking an issue in a list or board stores the list's query key, the identifiers in the order rendered (list: by group, collapsed groups skipped; board: column by column) and the list's full path. The header shows `n / total` with ↓/↑ buttons; `J`/`K` step when focus isn't in an input, editor, menu or dialog. Steps use `router.replace`, so Back returns to the list. The context only applies to the issue it was opened for or stepped to: any other way of reaching an issue (URL, search, a link) clears it and hides the counter. The total counts the issues the list had **loaded** (pages of 50), like the list's group counts. While the detail page is open, the source list's query (inactive) is refetched when invalidated (realtime) and the order is re-derived from its cache; if the current issue leaves the list, the counter hides.
- The "…" menu has only items for built features: **Remove ▸** (assignee, project, all labels, priority — only those set; optimistic like the sidebar), **Make a copy…** (create dialog in the issue's team, prefilled through `issuePrefill` like a template) and **Delete** (`⌘⌫` / `Ctrl ⌫`): a confirmation dialog, then `issues.delete`, a toast and `router.replace` back to the source list. Create related ▸ (needs M8 relations / sub-issues), Due date, Add link…, Mark as ▸ and Favorite (M8-02/05/04/07) are omitted until those exist, as is the favorite star.

## Project milestones

- A project has ordered milestones (`project_milestones`: name, optional description and `targetDate` (`YYYY-MM-DD`), `sortOrder`). Names are trimmed and unique per project (`project_milestones_project_id_name_unique` → `CONFLICT`); another project may reuse a name. New milestones go to the end. Any member may manage them, like projects.
- An issue has at most one milestone (`issues.milestone_id`), and it must belong to the issue's project: a milestone of another project, a missing one, one from another workspace, or a milestone on an issue without a project is `BAD_REQUEST` (on create and update). Changing or clearing the issue's project clears its milestone in the same transaction, unless the same update sets a milestone of the new project. Rules: `packages/core/src/projects/milestones` (`nextIssueMilestone`, `assertMilestoneInProject`). Bulk updates (`issues.bulkUpdate`) go through the same rule per issue, so moving issues to another project clears their milestones.
- Progress per milestone: `issueCount` counts every issue in it, `doneCount` the ones in a `completed` status (canceled issues stay in the total, like project progress); `progress` = done / total as a 0–1 fraction, 0 without issues. A milestone is complete when it has issues and all are done, so an empty milestone is never complete. A project's **current milestone** is the first one in order that isn't complete (`currentMilestone` on every project DTO; null when there is none).
- `milestones.list({ projectId })` returns a plain array in `sortOrder`. `milestones.reorder({ projectId, orderedIds })` puts the given ids first in that order and keeps the others after them in their current order (like favorites), so a stale tab can't drop a milestone; an id that isn't one of the project's milestones is `NOT_FOUND`. A project or milestone in another workspace is `NOT_FOUND`.
- Deleting a milestone keeps its issues in the project without a milestone (`ON DELETE SET NULL`); deleting the project deletes its milestones.
- Realtime: every milestone create, update, reorder and delete publishes `project.updated` for its project; a delete also publishes `issue.updated` (`milestone`) for each issue that lost it, and an issue update that changes the project lists `milestone` too. Milestone changes on issues are not written to the issue activity log; the project feed gets `milestone.created` and `milestone.completed` (see Project activity).
- App: the issue properties panel nests a Milestone picker under the Project row (tree line), only while the issue has a project; it lists the project's milestones with progress and saves through the optimistic `useUpdateIssue()` (a project change clears the milestone optimistically too). The milestone filter (`?milestone=<ids|none>`) is offered on a project page, or when the project filter is narrowed to one project. The projects table shows the current milestone as a chip next to the name. The project page has a Milestones section: "+ Milestone" inline add (↵ saves and keeps the row open, Esc cancels), drag to reorder (or Move up/down in the "…" menu), Rename, Set target date and Delete (confirmation). Rename, target date and reorder are optimistic with rollback; create and delete wait for the server. The milestone icon is a diamond whose fill rises with progress (`ink-subtle`, `status-completed` once complete).


- An issue may have one parent (`parentId`); any number of issues may share it. The parent must be in the same workspace (otherwise `NOT_FOUND`, so ids can't be probed); teams may differ. An issue can't be its own parent, nor the sub-issue of one of its descendants (`BAD_REQUEST`). Checks run in the write transaction, serialized per workspace by an advisory lock so two concurrent moves can't form a loop.
- Deleting a parent leaves its sub-issues as top-level issues (`ON DELETE SET NULL`); no activity is written for that, but each sub-issue gets an `issue.updated` (`parent`) event.
- Progress (`subIssueProgress`, null without sub-issues): `done` counts sub-issues in a `completed` status; canceled ones are left out of `total`. Lists and details show it as `done/total`.
- Activity: the child logs `parent` with the old/new parent **identifiers** (`TIP-12`); the old and new parent log `sub_issue` with the child's identifier (`to` when added, `from` when removed). Identifiers are stored rather than ids because team keys never change, so the timeline names issues without loading them. Creating an issue with a parent logs `sub_issue` on the parent only.
- Realtime: a parent change publishes `issue.updated` with `parent` for the child and `subIssues` for the old and new parent; a sub-issue's status change and creating or deleting a sub-issue also publish `subIssues` for its parent.
- Inline "Add sub-issues" creates in the parent's team, status and project; Enter creates and keeps the row open for the next title, Esc closes it. Sub-issues are listed oldest first; drag reorder is not supported yet.
- "Set parent issue…" (⇧⌘P, Ctrl+Shift+P off macOS) searches the workspace with `issues.list` (`excludeSubtreeOf` drops the issue and its descendants); "Remove parent" clears it. Both go through the optimistic `useUpdateIssue()`.
- Lists: `showSubIssues` (default on; URL `?subIssues=hide` turns it off) decides whether issues with a parent are listed. When shown, a sub-issue renders indented right after its parent if the parent is in the same status group and loaded; otherwise at the top level. Until the display options popover (M7-03) exists, the toggle lives in the order-by menu; "Clear" keeps it, like the sort.

## Activity

- Every issue change is logged in `activity_log`, in the same transaction as the change: `created` on create, then one entry per field whose value actually changed. Setting a field to the value it already had (including the same label set in another order, or a title that trims to the current one) writes nothing.
- Actor is `user` (with `actorId`) for changes made through the API, `github` (no `actorId`, with `pullRequestId` of the triggering PR) for automation. A deleted user's entries keep `actorType: user` with `actorId` null.
- `from`/`to` per kind: `title` text; `status`, `assignee`, `project` ids (or null); `priority` and `estimate` numbers (estimate null when unset); `labels` sorted label-id arrays; `due_date` `YYYY-MM-DD` days; `relation` `[role, otherIssueId, otherIdentifier]` in `to` when added and in `from` when removed, role read from this issue's side (`blocks`, `blocked_by`, `related`, `duplicate_of`, `duplicated_by`; the identifier is kept as it was at the time); `link` `[title, url]` in `to` when added and in `from` when removed. Ids are stored rather than names, so renamed statuses and labels show their current names. `created` and `description` carry no values (description text is not copied into the log).
- `activity.list` returns one issue's entries **oldest first** as `{ items, nextCursor }`, cursor = last entry id (UUIDv7), page size 50 (max 100). An issue outside the workspace is `NOT_FOUND`.

## Project activity

- Projects have their own feed in a separate `project_activity` table (not `activity_log`): its rows belong to a project rather than an issue, and its kinds are project events, so a nullable `projectId` plus a second set of kinds in `activity_log` would have made every issue query and the issue `kind` enum carry cases that can't apply. Rows are deleted with their project; a deleted actor keeps `actorType: user` with no actor.
- Kinds and `payload` (ids plus the from/to values needed to render; schema `projectActivitySchema` in packages/contract):
  - `project.created` — `{}`.
  - `project.status_changed` `{ from, to }` statuses; `project.priority_changed` `{ from, to }` numbers; `project.lead_changed` `{ from, to }` user ids (or null); `project.dates_changed` `{ field: 'startDate' | 'targetDate', from, to }` days (one entry per date field).
  - `project.issue_added` / `project.issue_removed` `{ issueId, identifier, title }`, identifier and title as they were at the time. Moving an issue between projects writes `issue_removed` on the old one and `issue_added` on the new one; creating an issue in a project writes `issue_added`. `issues.bulkUpdate` goes through the same path, one entry per issue, and publishes `project.updated` once per affected project. Deleting an issue writes nothing. Written with the issue change's actor.
  - `milestone.created` `{ milestoneId, name }` — written by `createMilestone` in its transaction, with the creator as actor.
  - `milestone.completed` `{ milestoneId, name }` — written in the issue update's transaction when the milestone's **last open issue moves to done**: the issue enters a `completed` status in this change and, counted after it, every issue of the milestone is done (`completesMilestone` in `packages/core/src/projects/milestones/rules.ts`). An issue that was already done (edited, re-saved, or moved into the milestone while done) never fires, nor does an empty milestone, deleting the last open issue or moving it out; reopening the last issue and finishing it again writes another entry. The actor is whoever moved the issue: a user, or `github` when PR automation moved it (the worker then publishes `project.updated`). The milestone row is locked before counting, so two last issues finishing at once write one entry. Renaming, reordering and deleting milestones are not logged.
  - `project_update.posted` `{ updateId }`: the contract and renderer handle it, but nothing writes it until project updates (M9-04, LIN-68) wire it through `recordProjectActivity` in the same transaction.
- Like issue activity, entries are written in the same transaction as the change, and a field set to the value it already had writes nothing. Name, description, icon, teams, members and labels are not logged.
- `projects.activity({ projectId, cursor, limit })` returns `{ items, nextCursor }` **newest first**, cursor = last entry id (UUIDv7), page size 50 (max 100). Each entry carries `actor` (`id`, `name`, `avatarUrl`; null for GitHub or a deleted user). A project outside the workspace is `NOT_FOUND`.
- Every write publishes `project.updated` for each project whose feed changed (an issue moving between projects publishes both, an issue completing a milestone publishes its project); clients refetch every project query, the feed included.
- App: `ProjectActivityCard` shows the latest 5 entries; "See all" opens `?tab=activity`, the full feed (`ProjectActivityFeed`, infinite scroll). Until the project tabs and right panel (M9-03, LIN-65) exist, the card sits in a right column of the project page (`lg` and up) and `?tab=activity` swaps the issue list for the feed. Dates read "Nov 3" (with the year outside the current one) and show the full timestamp on hover. A milestone completing reads without an actor ("Milestone M3 completed").

## Comments

- Comments belong to one issue and are deleted with it (`comments.issue_id` cascades). Bodies are markdown, trimmed, 1–50 000 characters; a blank body is `BAD_REQUEST`.
- Only the author may edit a comment; anyone else (owners included) gets `FORBIDDEN`. The author may delete their own comment, and workspace owners may delete anyone's (see Roles); other members get `FORBIDDEN`.
- An edited comment keeps `createdAt` and gets a new `updatedAt`; saving the same body is a no-op. Edits and deletes are not written to `activity_log`.
- `comments.list` returns one issue's **thread roots oldest first** as `{ items, nextCursor }`, cursor = last root id (UUIDv7), page size 50 (max 100). Each root carries its first 50 replies (`replies`, oldest first) and the total `replyCount`. Every comment carries its author's `id`, `name` and `avatarUrl`, `parentId`, `reactions` and `resolvedAt`. An issue or comment outside the workspace is `NOT_FOUND`.
- **Threads:** a reply sets `parentId` to a root comment. Threads are one level deep: replying to a reply, or to a root on another issue, is `BAD_REQUEST`; a parent outside the workspace is `NOT_FOUND`. Deleting a root deletes its replies (`comments.parent_id` cascades).
- **Resolving:** any member may resolve or reopen a thread (`resolveThread` / `unresolveThread`, roots only; a reply is `BAD_REQUEST`). Both are idempotent and don't count as an edit (`updatedAt` stays). Posting a reply reopens a resolved thread. The UI folds a resolved thread into a one-line "Resolved thread · N replies" summary that expands on click (or when a link points into it).
- **Reactions:** any member may react to any comment (root or reply) with an emoji from the contract's allowlist (`REACTION_EMOJIS`, 48 single emojis; anything else is `BAD_REQUEST`). One reaction per user per emoji per comment (`comment_reactions_comment_id_user_id_emoji_unique`); `react` and `unreact` are idempotent. A comment's `reactions` are `{ emoji, count, reactedByMe }` per emoji, ordered by when that emoji was first used. Reactions are deleted with their comment or user and are not written to `activity_log`.
- The UI shows edit and delete only to the author (the server still lets owners delete, see Roles). Copy link copies the issue URL with `#comment-<id>`; opening it scrolls to that comment and highlights it.

## Relations

Issues in the same workspace can be related (`issue_relations`). Types and stored direction:

| Type        | Stored as                                    | Read from the issue's side                      |
| ----------- | -------------------------------------------- | ----------------------------------------------- |
| `blocks`    | `issueId` blocks `relatedIssueId`            | `blocks` (source) / `blockedBy` (target)        |
| `related`   | once, either way round                       | `related` on both                               |
| `duplicate` | `issueId` is a duplicate of `relatedIssueId` | `duplicateOf` (source) / `duplicates` (target)  |

- A pair of issues has at most one relation of each type, **in either direction**: repeating it, or creating the reverse (B blocks A when A blocks B, B related to A, B duplicate of A), is `CONFLICT`. Different types between the same pair are allowed. Enforced by the unique constraint plus a unique index on `(least, greatest, type)`.
- An issue cannot relate to itself (`BAD_REQUEST`; also a DB check). Both issues must be in the workspace, otherwise `NOT_FOUND`. Relations are deleted with either issue (cascade).
- **Duplicate rule:** marking an issue as a duplicate moves it, in the same transaction, to its team's first `canceled`-category status (lowest position) and logs that status change. An issue already `completed` or `canceled`, or a team without a canceled status, keeps its status. Removing the relation does not restore the old status.
- `issues.get` / `getByIdentifier` return `relations` (`blocks`, `blockedBy`, `related`, `duplicateOf`, `duplicates`), each an issue summary (id, identifier, title, status) plus `relationId`, oldest relation first. Every issue DTO (list rows included) has `blockedByCount` / `blockingCount`: `blocks` relations whose **other** issue is still open (not `completed` or `canceled`).
- Creating or removing a relation writes a `relation` activity entry on **both** issues (see Activity) and publishes `issue.updated` with `fields: ['relations']` for both (plus `status` for a duplicate that was canceled). A status change of a blocker does not republish its blocked issues; their counts refresh on the next list fetch.
- Any member may create and remove relations. In the app: the detail header "…" menu → **Mark as** ▸ Blocked by… / Blocking… / Related to… / Duplicate of… opens an issue search (the issue itself excluded).

## Links

Web links attached to an issue (`issue_links`; deleted with the issue). Shown with the issue's linked GitHub PRs as one **Resources** list under the description.

- **URLs:** absolute `http:` / `https:` only, trimmed, at most 2048 characters (`linkUrlSchema` in the contract; core re-checks). `javascript:`, `data:`, `ftp:`, `mailto:` and relative URLs are `BAD_REQUEST`.
- **Titles:** optional, trimmed, at most 255 characters. An empty title is stored as the URL's hostname without a leading `www.` (`https://www.figma.com/…` → `figma.com`). Editing the URL of a link whose title is still the default moves the title to the new hostname; a custom title is kept; saving an empty title resets it to the hostname.
- **No fetching:** the server never requests the linked page (no title scraping, no favicons), so links add no SSRF surface. Rows use a generic link icon.
- `issueLinks.create({ issueId, url, title? })`, `issueLinks.update({ id, url?, title? })`, `issueLinks.delete({ id })`: any member. An issue or link outside the caller's workspace is `NOT_FOUND`.
- `issues.get` / `getByIdentifier` return `links` (`id, url, title, hostname, createdAt`), oldest first. Linked PRs keep coming from `github.pullRequests.listForIssue` (see GitHub PR linking).
- Adding and removing a link write `link` activity ("added link Spec" / "removed link Spec"); editing a link is not logged. Every create, update and delete publishes `issue.updated` with `fields: ['links']`.
- **Filter:** `issues.list({ hasLinks: true })` keeps issues with at least one web link **or** linked PR; `false` keeps issues with neither. The filter menu's Links entry offers **Has links** / **No links** (`?links=has|none`) next to **Has pull requests** / **No pull requests** (`?pr=yes|no`, `hasPullRequests`, linked PRs only); each pair is one value at a time, and both combine by AND. The Details panel counts (`issues.facets`) take the same filter, and those counts refresh when an issue's links or linked PRs change.
- **App:** `Ctrl L` on the issue page (⌃L on macOS, where ⌘L is the address bar; it also works while typing in the description) or "…" → **Add link…** opens the URL / "Title (optional)" dialog. PR rows show the state icon, `#number`, title and repo; link rows show title and hostname (hidden when the title is the hostname). Rows open in a new tab (`rel="noopener noreferrer"`); hover or focus shows Copy link, and for web links Edit and Remove (optimistic, rolled back with a toast).

## Realtime events

Open clients learn about changes as they happen (ADR 0011). Events are hints, not data: they carry IDs and the client refetches what it shows.

- **Events:** `issue.created`, `issue.updated` (with `fields`: any of `title`, `description`, `status`, `priority`, `assignee`, `project`, `milestone`, `labels`, `dueDate`, `pullRequests`, `subscribers`, `relations`, `links`), `issue.deleted`, `comment.created`, `comment.updated`, `comment.deleted`, and `project.updated` (`projectId` + `actorId`, published after every project create, update and delete, and when an issue is created in or moved between projects since their activity feeds change; clients refetch their project queries, activity included, coalesced). Issue and comment events have `issueId` and `actorId` (the user, or `null` for GitHub automation); comment events add `commentId`. `template.updated` (create, edit or delete of an issue template) carries `templateId` and `actorId` instead of `issueId`. `view.updated` (create or edit) and `view.deleted` carry `viewId` and `actorId` (see Views). Schemas: `packages/contract` (client DTO) and `packages/queue` (Redis bus, same shape plus the internal `originId`).
- **Who publishes:** the API after a successful `issues.create`/`update`/`delete` and `comments.create`/`update`/`delete` (replies are `comment.created`; reactions and resolving a thread are `comment.updated` of that comment); the worker after a `pull_request` delivery commits, one `issue.updated` per issue whose links or status it changed (`fields` = `pullRequests`, plus `status` when automation moved it). Skipped redeliveries publish nothing. `issue.updated.fields` lists the fields the request set, even if a value didn't change.
- **Channel:** Redis pub/sub `workspace:<workspaceId>`. Every API instance subscribes to a workspace's channel while one of its sockets watches that workspace.
- **Who receives:** only sockets subscribed through `realtime.subscribe`, which requires a session and workspace membership (`requireWorkspace`; non-members get `NOT_FOUND` and no events). The upgrade at `/rpc/ws` is rejected with `401` without a session and `403` for a foreign `Origin`. Membership is checked when subscribing; there is no member removal yet, so it isn't rechecked mid-stream.
- **Echoes:** each browser tab has a random client id, sent as `x-client-id` on every request and with the subscription. Events caused by a tab are not sent back to that tab (it already applied them optimistically). Other tabs of the same user do receive them.
- **Delivery:** best effort, at most once, no replay. A failed publish is logged and never fails the change. Clients reconnect with backoff (1 s doubling to 30 s, jittered) and refetch their active queries after a reconnect.
- **Client handling:** `issue.updated` fetches that issue once and patches it into every cached list and detail copy (skipped while the tab has its own edit in flight, which refetches when it settles); lists refetch, coalesced, only on create or when `assignee`/`project` changed (membership of My Issues and project views); other changes refetch only the filtered or sorted lists they can affect (`status` → status filter or the overdue filter, `priority` → priority filter or sort, `dueDate` → due filter or sort, `labels` → label filter, `title` → search, any change → `updatedAt` sort); deletes drop the issue from lists; comment events refetch that issue's comments (`comment.created` also refetches its subscribers and `isSubscribed`); `subscribers` refetches that issue's subscriber list and lists filtered by subscriber; `template.updated` refetches the template lists; `view.updated` / `view.deleted` refetch every view query and the favorites list.
- **Per-user events:** `notification.created { notificationId }` travels on `user:<userId>` (bus shape adds the routing `workspaceId`). Each socket's stream merges its workspace channel with its own user's channel, filtered to that workspace, so only the recipient's sockets in that workspace receive it (see Notifications).
- **Not covered yet:** collaborative editing.

## Presence

Who is online and which issue they're looking at. Ephemeral: Redis only, no table, nothing in the activity log.

- **Heartbeat:** `presence.heartbeat { workspaceSlug, viewingIssueId: uuid | null, state: 'active' | 'away' }`, sent by each tab every 20 s, when the viewed issue changes, when the tab is hidden/shown (`away` while hidden), and on (re)connect. It is accepted only over the realtime WebSocket, from a socket currently subscribed to that workspace (`realtime.subscribe`), with membership checked by `requireWorkspace` (non-members `NOT_FOUND`). A heartbeat over HTTP, from a socket not subscribed to the workspace, or naming an issue outside the workspace is dropped silently (no error, nothing stored).
- **Storage:** `presence:<workspaceId>:<userId>` is a hash of the user's live connections (one per socket) → `{ state, viewingIssueId, at }`, key TTL 60 s refreshed per heartbeat; `presence:<workspaceId>` is a sorted set of userIds scored by expiry, used for listing; `presence:<workspaceId>:seen` keeps each user's last heartbeat time (no TTL) for "last seen". A connection with no heartbeat for 60 s counts as gone; expired users are pruned when the list is read.
- **Merging tabs:** a user is `active` if any live connection is active, else `away`; `viewingIssueId` comes from the most recent active connection (else the most recent one).
- **Disconnect:** closing a socket removes that connection right away; the user goes offline when their last connection is gone.
- **Events:** `presence.changed { userId }` on `workspace:<id>` when a user's merged state or viewed issue changes, when a socket closes and that changes it, and for users pruned as expired on read. Clients refetch `presence.list`; it also refetches every 60 s to catch tabs that died without closing.
- **`presence.list`:** members only (`requireWorkspace`); returns `{ userId, state: 'active' | 'away' | 'offline', viewingIssueId, lastSeenAt }` for **current members** with a live connection or a known last-seen time. Entries for non-members (e.g. removed members) are never returned.
- **UI:** avatars show a green (`success`) dot for active, a hollow `ink-subtle` dot for away, nothing for offline; the dot is ringed in the surrounding surface color (`--avatar-ring`, default `panel`; the spec's "canvas ring" taken as "the surface behind the avatar"). The issue detail header shows the other members viewing the issue (you are excluded): up to 3 stacked avatars + "+N", tooltip "<name> is viewing". Settings → Members shows "Online" / "Away" / "Last seen …" / "Offline".

## Cycles

Time-boxed iterations per team (M8-06). Off by default; owners turn them on in team settings (`teams.update`).

- **Settings** (team columns): `cyclesEnabled`, `cycleDurationWeeks` 1–8 (default 2), `cycleStartWeekday` 0–6 with 0 = Sunday (default Monday), `cycleCooldownWeeks` 0–2 (default 0), `cycleUpcomingCount` 1–6 (default 2), `cycleAutoAddStarted` and `cycleRolloverUnfinished` (both default on). Out-of-range values are `BAD_REQUEST`; members get `FORBIDDEN`.
- **Date math** (`packages/core/src/cycles/schedule.ts`): cycles run on **UTC calendar days**. A cycle starts at 00:00 UTC on the start weekday and is the half-open window `[startsAt, endsAt)`, exactly `duration` weeks long, so DST never stretches or shifts it. The UI shows the first and last day in UTC ("Nov 2 – Nov 15"). A team's first cycle starts on the latest start weekday at or before today, so it has a current cycle at once. Each next cycle starts at the previous end plus the cooldown, aligned forward to the start weekday; a chain that ended more than a full cycle ago restarts in the current week. Scheduling keeps a current cycle (none during a cooldown) plus `upcomingCount` cycles starting after now. Changing the settings never moves existing cycles; new ones follow the new settings. Numbers are per team (`cycles_team_id_number_unique`), 1, 2, 3… in date order.
- **Scheduling**: turning cycles on (or saving any cycle setting while they are on) schedules the missing cycles in the same request. After that, the `cycles-maintain` job (maintenance queue, every hour on the hour in UTC) runs one transaction per team with cycles on, holding the team row lock:
  1. create missing upcoming cycles;
  2. for each open cycle that has started, record today's point in `scopeSnapshot` / `completedSnapshot` (index = cycle day, missing days are `null`; a rerun on the same day replaces the point);
  3. close ended cycles (`completedAt` = run time), first recording their last-day point, then, with rollover on, moving their unfinished issues (status not completed/canceled) to the team's next open cycle, publishing `issue.updated` with `fields: ['cycle']` and `actorId: null` per moved issue.
  Every step is idempotent, so a rerun in the same hour (team + hour) changes nothing but the snapshot values. Rollover is not written to the activity log. A team with cycles turned off is skipped; its cycles stay as they are.
- **Assigning**: `issues.create` / `issues.update` accept `cycleId` (`null` removes it). The cycle must be an open (not completed) cycle of the issue's own team; another team's cycle, a completed one, or one from another workspace is `BAD_REQUEST`. Changes are logged as activity kind `cycle` (from/to cycle ids).
- **Auto-add**: with cycles and `cycleAutoAddStarted` on, an issue that moves to a different status in the `started` category (or is created in one) and has no cycle joins the current cycle, unless the same request sets `cycleId`. No current cycle (cooldown) means nothing happens. GitHub automation goes through the same update, so a PR opening also auto-adds.
- **Progress**: `scope` counts every issue in the cycle except canceled ones; `started` and `completed` count the `started` / `completed` categories. Counts are live; the chart uses the daily snapshots.
- **API**: `cycles.list({ teamId })` returns a plain array ordered current, upcoming (soonest first), past (newest first); a team outside the workspace is `NOT_FOUND`. `cycles.get` adds the snapshots; `cycles.update` renames (blank clears; the UI then shows "Cycle <n>"). Cross-workspace ids are `NOT_FOUND`. `issues.list` takes `cycleId` (page scope) and `cycleIds` (filter, `null` = no cycle; `?cycle=<ids|none>` in the URL).
- **App**: the sidebar shows team › **Cycles** only for teams with cycles on. The cycle picker (`⇧C`, issue properties; row picker on rows already in a cycle; create dialog when the team has cycles on) offers No cycle, the current cycle and upcoming ones as "Cycle 4 · Nov 2 – Nov 15", optimistic with rollback. The filter menu offers Cycle on a team's issue views (team with cycles on). The settings preview shows the current or next scheduled cycle, or what the first cycle would be (a client mirror of the first-cycle rule).

## Subscribers

Subscribers are the audience for Inbox notifications (M10-02). Stored in `issue_subscriptions` (one row per issue and user, unique `issue_subscriptions_issue_id_user_id_unique`, cascades with the issue and the user).

- **Auto-subscribe**, in the same transaction as the write: the creator (and the assignee, if any) on create; the new assignee when `assigneeId` changes to someone else (re-saving the same assignee doesn't re-subscribe someone who unsubscribed); the author on comment create; @mentioned users once M10-03 calls `subscribeUsers(tx, issueId, userIds)`. GitHub automation never subscribes anyone.
- Subscribing is idempotent (`on conflict do nothing`), unsubscribing someone who isn't subscribed is a no-op. Only workspace members can be subscribed: `subscribeUsers` silently skips others, `issues.subscribe` with a non-member `userId` is `BAD_REQUEST`.
- `issues.subscribe` / `issues.unsubscribe` take `{ workspaceSlug, issueId, userId? }`; `userId` defaults to the signed-in user, and any member may add or remove another member (the sidebar picker). Output `{ subscribed }` is that user's new state. An issue outside the workspace is `NOT_FOUND`.
- `issues.subscribers` returns current members only (someone who left keeps the row but isn't listed), oldest subscription first, as a plain array.
- Every issue DTO carries `isSubscribed` for the signed-in user (lists too, so cached copies agree).
- The **Subscribers** filter (`subscriberIds`, any of; `me` = the signed-in user, kept as `me` in the URL so a shared link means the viewer) matches issues with a subscription by one of them in the same workspace.
- Subscribe, unsubscribe and an assignee change publish `issue.updated` with `subscribers`. The bell (`⇧S`) toggles the signed-in user; it uses BellPlus / BellOff so it reads apart from the header's notifications bell.

## Notifications

Every member has a personal Inbox per workspace (M10-02). Stored in `notifications`: one row per recipient, `type`, `issueId`, `actorType` (`user` | `github`) + `actorId` (null for GitHub), a DTO-safe `payload` (status ids, comment id, PR id/number — never rows), `readAt`, `snoozedUntil`, `archivedAt`. Index `(user_id, workspace_id, created_at desc)`; rows cascade with the issue, user and workspace.

- **Types and recipients** (`recipientsFor` in `packages/core/src/notifications`, pure): `assigned` → the new assignee; `mentioned` → the mentioned users (enqueued by M10-03); `issue_created_in_team` → the team's members, minus the issue's assignee (who gets `assigned`); `commented`, `status_changed`, `pr_linked` → the issue's subscribers. Always: the actor is never notified, only **current workspace members**, each user at most once per event. Events are not merged across types (an assignee who is also subscribed gets `assigned` and later `status_changed`, not one combined row).
- **Pipeline:** after its commit, the API enqueues one `notify` job per event (`notifications` queue, payload `{ workspaceId, issueId, event, actorId, activityId? | commentId? | deliveryId?, pullRequestId?, userIds? }`, exactly one source id): `issues.create` → `issue_created_in_team` (+ `assigned` when created with an assignee), both sourced from the `created` activity entry; `issues.update` → `assigned` per assignee activity entry with a new assignee, `status_changed` per status entry; `comments.create` (replies too) → `commented`. The GitHub worker, after a processed delivery, enqueues `pr_linked` for each newly linked issue (or a reference that became closing; source = delivery id) and `status_changed` per automated status entry (`actorId` null). An enqueue failure is logged and never fails the write. Other fields (title, priority, labels…) don't notify.
- **Idempotency:** the source key is `notify-<event>-<issueId>-<sourceId>`; it is the BullMQ job id and part of the unique `(user_id, source_key)` guard, so a retried request, job or delivery creates each row once. The job reloads what it refers to and does nothing when the issue, activity entry or comment is gone.
- **Realtime:** after inserting, the worker publishes `notification.created` (ID only) to each recipient (Realtime events → Per-user events). The app refetches the Inbox and the unread count. Read/archive/snooze in one tab are not pushed to the user's other tabs; they refetch on focus or the next event.
- **API** (`notifications.*`, all `requireWorkspace`, every query filters by the signed-in user and workspace; another user's id is `NOT_FOUND`): `list({ filter: 'all' | 'unread', cursor, limit })` newest first (cursor = notification id), leaving out archived and currently snoozed rows, each with actor (name, avatar URL), issue (identifier, title, status) and a server-built `summary` ("Ada assigned you", "GitHub changed status to Done", "Ada linked PR #12"; a deleted user reads "Someone"); `unreadCount` (unread, not archived, not snoozed); `markRead`, `markUnread`, `markAllRead` (visible unread ones; returns the count), `archive` (no unarchive yet), `snooze({ id, until })`.
- **Snooze:** `until` is computed by the client in the viewer's time zone — In 1 hour, Tomorrow 9:00, Next week = next Monday 9:00 (a week later on a Monday) — and must be in the future and at most a year ahead (`BAD_REQUEST`). Snoozing also marks the row unread, so it resurfaces with a badge once `snoozedUntil` passes; it then sorts at its original time.
- **App:** `/:workspaceSlug/inbox` (lazy) has a 360px list (All / Unread, Remind me, Archive, "…" → Mark all as read) and the selected issue's full detail page on the right (the issue sets the panel breadcrumb). Rows: actor avatar (GitHub mark for automation), mono identifier + title (medium while unread), status icon + summary, short age (`5m`, `3h`), lavender unread dot. Keys (catalog scope Inbox): `J`/`K` (or ↓/↑) move and open, `E` or `Backspace` archive, `U` toggles read, `⇧H` opens Remind me. Opening a notification marks it read; archive and snooze move the selection to the next row. All mutations are optimistic on every cached list and the unread count, rolled back with a toast. Empty: "No notifications".

## Labels

- A label is either a **workspace label** (`teamId` null, usable by every team) or a **team label** (owned by one team, usable only on that team's issues; another team's label on an issue is `BAD_REQUEST`). Team labels are deleted with their team. Any member may create, rename, recolor or delete either kind.
- Names are trimmed, 1–80 characters, and unique per scope: among the workspace labels, and within each team (exact match, so `Bug` and `bug` can coexist). A team label may share a name with a workspace label or another team's label. A duplicate is `CONFLICT`. A `teamId` from another workspace is `NOT_FOUND`.
- `labels.list` with a `teamId` returns the workspace labels plus that team's; without one, every label in the workspace (the filter menus and pickers load this once and narrow per issue team on the client). Each label carries its `teamId`.
- Label picker (`L`): sections Selected (as the picker opened, so rows don't jump while toggling), Team labels, Workspace labels; each row a checkbox, color dot and name. Typing a name with no case-insensitive exact match in those sections shows "Create new label: “…”" as the last row; ↵ or a click creates it as a **team** label in the issue's team and applies it, without closing the picker. The color is the label palette color used least by the labels in scope (palette order breaks ties; `features/labels/label-options.ts`). The create request runs first; applying the new label then goes through `useUpdateIssue()` (optimistic, rollback + toast). A `CONFLICT` on create (someone just created that name) applies the existing team label instead. Space toggles the highlighted row while the filter is empty. In the create dialog, changing team drops the old team's labels. In the template form the picker follows the template's scope: a team template offers that team's labels too, a workspace template only workspace labels (and creates workspace labels).
- Workspace settings → Labels manages workspace labels; team settings → Labels manages that team's labels: rename inline (Enter/blur saves, Esc reverts), recolor from the palette, delete after a confirmation. New labels are created from the picker.
- Colors are stored as lowercase `#rrggbb`. They are user data rendered as-is, not design tokens.
- Deleting a label removes it from every issue (`issue_labels` cascades).

## Templates

- An issue template prefills the create-issue dialog; it never creates issues itself. `teamId` null is a **workspace template** (offered for every team); otherwise a **team template** (offered only when that team is picked). Any member may create, edit or delete them, like labels.
- Names are trimmed, 1–80 characters, unique per scope (`issue_templates_workspace_id_team_id_name_unique`, `NULLS NOT DISTINCT`, so two workspace templates can't share a name either); a duplicate is `CONFLICT`. The scope is fixed at creation.
- Every property is optional: title (empty = none), markdown description, status, priority (null = keep the team default; the form's "No priority" stores null), assignee, project, labels. Estimates join when LIN-55 lands.
- Every referenced entity (team, status, assignee membership, project, labels) must belong to the workspace, else `NOT_FOUND`. A team template's status must be one of that team's (`BAD_REQUEST` otherwise). A workspace template may use any workspace status; the dialog resolves it in the picked team by **category** (that team's first status of the category by position), falling back to the team default. The template form picks from the first team's statuses for a workspace template.
- Deleted statuses, assignees and projects are cleared (`on delete set null`); deleted labels are dropped when the template is read (`labelIds` has no FK). A team template is deleted with its team.
- `templates.list` returns workspace templates, plus that team's with `teamId`; workspace templates first, then by name. Workspace settings show workspace templates; a team's settings show both.
- **Prefill rules** (`prefillFrom` in `apps/app/src/features/issues/prefill.ts`, the app can't import `packages/core`): a field the user set by hand — or the dialog's opener set (a group's `+`, a project page) — is never overwritten; every other field takes the source's value, else the team's issue default. Switching templates or choosing "No template" therefore resets what the previous template filled. Clearing the title or description hands it back to the template. A source assignee who is no longer a member is skipped. Switching to another team drops a team template.
- **Make a copy…** prefills through the same helper from `issuePrefill(issue)`: title `Copy of <title>`, description, status (by category in another team), priority, assignee, project and labels. Opened with `ui.openCreateIssue({ teamId }, issuePrefill(issue))`; its menu entry comes with the issue "…" menu (LIN-72).
- **Copy actions** (M7-08): the detail page header has Copy issue URL (`⌘⇧,`), Copy ID (`⌘.`), Copy git branch name (`⌘⇧.`) and a "Copy as prompt" split button (`⌘⌥P`); the "…" menu's **Copy ▸** lists the same four. Ctrl replaces ⌘ and Alt replaces ⌥ off macOS. The four are listed in the shortcut catalog (`lib/hotkeys.ts`, Issue scope) for the `?` sheet and the hints, but match on `event.code` (layout-independent; ⌥P types `π` on macOS) in `copy-shortcuts.ts`. They are ignored while focus is in an input, textarea or editor or a dialog is open, and bound only while the detail page is mounted. Success toasts "Copied", failure "Couldn't copy".
- **Git branch name** (`issueBranchName` in `apps/app/src/features/issues/issue-branch.ts`): a first non-empty description line ``**Branch:** `name` `` wins. Otherwise `<handle>/<identifier lowercased>-<title slug>`: the handle is the current user's email local part slugified (else their name, else no prefix); the slug is lowercase ASCII (accents stripped), runs of other characters become one hyphen, trimmed, at most 60 chars cut at the last word boundary (a single longer word is cut at 60). The identifier starts its own `/` segment, so a PR from this branch links back (see GitHub PR linking).
- **Copy as prompt** (`buildIssuePrompt` in `issue-prompt.ts`): `Work on <workspace name> issue <ID>:`, a blank line, `Suggested branch name: <branch>`, a blank line, then `<issue identifier>` with `<title>`, `<description>` (omitted when empty), `<team name/>`, one `<label>` per label, `<project name>` with the project description as body (self-closing without one; omitted without a project) and `<issue-relations><blocked-by><issue-ref identifier title/>…</blocked-by></issue-relations>` from the issue's blocked-by relations (M8-04; omitted when none). Attribute values escape `& < > " '`; element text is verbatim so markdown reads as written. "Configure coding tools…" opens a Settings › Coding tools placeholder until integrations exist.

## App shell

- Sidebar sections (Workspace, Your teams, Favorites) start expanded; each team row starts collapsed and expands when one of its pages is opened. The state is per browser (`sidebar-sections` in localStorage), never server data.
- `team/:teamKey` redirects to `team/:teamKey/issues`. The team Projects page lists the workspace projects whose `teamIds` include the team (client-side filter of `projects.list`).
- The sidebar Search button opens the command menu (⌘K) and the help button opens the keyboard shortcuts sheet (`?`). Inbox and the notifications bell open the Inbox; the sidebar Inbox row shows the unread count (hidden at 0, see Notifications). Views pages list saved views (see Views); Favorites stays hidden while empty.
- The content panel keeps the `panel` surface and light-mode panel shadow from design.md → App shell (design.md wins over the issue's `bg-surface-1` / no-shadow wording).

## Keyboard shortcuts and command menu

- Every shortcut is declared once in the catalog `SHORTCUTS` (`apps/app/src/lib/hotkeys.ts`): keys, label, scope. Components bind handlers by catalog id with `useHotkeys` while mounted; the `?` sheet and the command menu's hints render from the catalog, so they can't drift. New shortcuts add a catalog entry, then bind it; the issue page's J/K prev/next (M7-07, `useIssueNav`), its header's ⌘⌫ delete and the list `F` filter key are bound this way. No component listens to keydown for app shortcuts directly.
- `mod` is ⌘ on macOS and Ctrl elsewhere. Chords (`G I`) must complete within 1s; otherwise the second key is matched on its own.
- Scope precedence when several bindings share a key: picker > issue > list > global; within a scope the most recently mounted wins. A handler can decline (return `false`) and the next match runs.
- While focus is in an input, textarea, select or editor (contenteditable, incl. the description editor), only bindings that opt in with `allowInInputs` and use ⌘/Ctrl/Alt fire. Only ⌘K and Ctrl L (add link) opt in: ⌘⌫ in a field still deletes text, never the issue.
- While a dialog, sheet or popover is open, only `inDialog` bindings fire: ⌘K (toggles the menu; ignored over another dialog) and the S/P/A/L picker keys (only the topmost dialog's pickers respond).
- The "active issue" for the command menu's issue actions and ⌘⌫ is the open issue on its page, or the J/K-focused row in a list. `G T` goes to the current page's team, else the active issue's team (identifier prefix), else the first team.
- Deleting always asks for confirmation (focus starts on Cancel). It is optimistic: the issue leaves every list at once and comes back with a toast if the server refuses; deleting the open issue first navigates back.
- Copy git branch name gives `tip-200-<title slug, ≤40 chars>` so PR linking matches it (see GitHub PR linking). M7-08 may refine the copy actions.
- List keyboard navigation (J/K, Enter, X, Esc) covers the list layout; X adds the focused row to the bulk selection (see Bulk actions). On the board, X toggles the card holding focus (Tab to it) and Esc clears the selection; board J/K focus movement is not implemented yet.

## Bulk actions

- Lists and boards support multi-select: X toggles the focused issue; click the checkbox or ⌘/Ctrl-click a row or card to toggle one; shift-click (also shift on the checkbox) selects every issue between the last one clicked and this one, in render order (on the board: down each column, left to right; collapsed list groups are skipped). A group header or column checkbox selects every issue in the group, or clears it when the whole group is selected already. Esc clears the selection. The selection is UI state (a Pinia store): it drops issues that leave the view and is cleared when the view unmounts.
- A floating bar shows "N selected" (× clears) and Status, Priority, Assignee, Labels, Project and Delete. Each picker shows the value every selected issue shares, or its name when they differ. Statuses and team labels belong to a team, so Status is shown only when every selected issue is in one team, and Labels offers workspace labels plus that team's labels (workspace labels only across teams).
- Labels are added and removed per issue, never replaced: the label picker checks the labels every selected issue has; checking one adds it to all of them, unchecking removes it from all. The selection stays after a label change so several can be toggled in a row; every other change, and delete, clears it on success.
- API: `issues.bulkUpdate { ids, patch }` with `patch` ⊂ `statusId`, `priority`, `assigneeId`, `projectId`, `addLabelIds`, `removeLabelIds` (at least one), and a separate `issues.bulkDelete { ids }` (a separate procedure keeps each output a plain shape and delete never mixes with property changes). Both take 1–250 ids (more is `BAD_REQUEST`) and are all or nothing in one transaction: any id outside the workspace fails the whole call with `NOT_FOUND`, and any invalid value for one issue (e.g. a status or label of another team) fails it with `BAD_REQUEST` and changes nothing.
- Each issue goes through the single-issue rules (`updateIssue` / `deleteIssue`): validation against its own team and workspace, `completedAt`, cycle auto-add, assignee subscription, and one activity entry per changed property (an issue whose values already match gets none). After commit the API publishes one ID-only `issue.updated` / `issue.deleted` event per issue, plus the usual sub-issue events for parents.
- The bar's changes are optimistic in every list, board and detail cache and rolled back with a toast if the server refuses; deletes need a confirmation dialog.

## Favorites

- Favorites are personal: a row belongs to one user in one workspace (`favorites.userId` + `workspaceId`), and every procedure filters on both. Another user's favorite id is `NOT_FOUND`; there is no realtime broadcast, the app refetches its own list after a change.
- Entity types are `issue`, `project`, `team` and `view`. A view can be favorited only while the user can see it (shared, or their own private view); otherwise `NOT_FOUND`, and `favorites.list` skips view favorites that are no longer visible. Adding an entity that isn't in the workspace is `NOT_FOUND`; adding one that is already a favorite returns the existing favorite (no-op).
- Order is an integer `sortOrder`; new favorites go last. `favorites.reorder({ ids })` puts the given ids first in that order and keeps any favorites it didn't mention after them in their current order (so a stale tab can't drop one). An id that isn't the caller's, or a repeated id, is `NOT_FOUND`.
- There is no FK from a favorite to its entity, so deleting an issue or project deletes its favorites in the same transaction (`deleteFavoritesOf`). Deleting a view does the same; future deletes of teams (and their issues) must too. `favorites.list` also skips favorites whose entity no longer resolves.
- The list returns a display summary per favorite, resolved server-side: issue identifier, title and status category; project name and icon URL; team name and key; view name, icon and color.
- App: the header star (tooltip "Favorite" / "Unfavorite") and `⌥F` act on the page's entity, set by the issue detail header, project detail and team issues pages (`ui.favoriteTarget`, cleared on navigation). `⌥F` is listed in `SHORTCUTS` (`toggle-favorite`) for the sheet, but WorkspaceLayout matches it by key code rather than through `useHotkeys`, because macOS types `ƒ`. It's ignored while typing and while a dialog is open. Add and remove are optimistic with rollback; an optimistic row can't be removed or reordered until the refetch gives it a real id.
- The sidebar Favorites section sits between Workspace and Your teams (where M7-01 left its slot) and is hidden when empty. Rows reorder by drag, or with "Move up" / "Move down" in the row's "…" menu (keyboard path); right-click opens the same menu, which has "Remove from favorites". The favorited star uses `status-started` yellow, like Linear.
- The issue "…" menu has "Add to favorites" / "Remove from favorites" (⌥F). The project "…" menu gets the same item when M9-03 adds that menu (reuse `useToggleFavorite`).

## Views

- A **view** saves an issue list's filters and display options under a name, an icon and a color (`views` table). `teamId` null is a **workspace view**; otherwise a **team view** (DTO `scope: 'workspace' | 'team'`). The scope is fixed at creation. A team view is deleted with its team.
- **What's saved:** `filters` is `viewFiltersSchema`, i.e. `issueFiltersSchema` minus the page scope and derived keys (`workspaceSlug`, `teamId`, `projectId`, `milestoneId`, `cycleId`, `assignee`, `creator`, `statusCategories`, `completedAfter`, `today`, `showSubIssues`, `excludeSubtreeOf`). New list filters (e.g. LIN-67's `…Not` lists, `labelMode`, creator, date bounds, content, `hasPullRequests`) are saved automatically. On top, `createdWithin` / `updatedWithin` / `completedWithin` (`day`, `week`, `month`, `3months`) keep the filter menu's "past …" windows relative; the app turns them into `…After` bounds when it lists, so a saved view never goes stale. "Before / after a day" is stored as the viewer's local midnight and read back as that calendar day. `today` is never stored. Input is strict: unknown keys and invalid values are `BAD_REQUEST`. `display` is M7-03's `displayOptionsSchema` (layout, grouping, ordering + direction, completed issues, sub-issues, empty groups, properties). The color is a semantic token key (`neutral`, `started`, `completed`, `success`, `urgent`), never hex; the icon is one of a fixed set.
- **Stored JSON is never trusted:** on read, `filters` and `display` are parsed field by field (`parseStoredViewFilters` / `parseStoredViewDisplay`). A field that no longer parses is dropped, an unknown icon or color reads as `layers` / `neutral`, and the app fills missing display options with its defaults. Dates come back from JSON as ISO strings and are revived for date fields.
- **Visibility:** shared views (the default) are visible to every member; a private view (`shared: false`) only to its owner. Someone else's private view is `NOT_FOUND`, for workspace owners too.
- **Permissions:** any member can create a view. A shared view can be edited or deleted only by its owner or a workspace owner (`FORBIDDEN`). A private view can be changed by whoever sees it, i.e. its owner. Duplicating creates a new view owned by the caller.
- **References:** `teamId` and every id inside `filters` must belong to the workspace, else `NOT_FOUND`. The check covers every `<entity>Ids` / `<entity>IdsNot` filter (status, assignee / creator / subscriber as members, project, milestone, cycle, label; `null` and `me` skip it). An id filter for an entity with no check fails loudly, so a new one can't skip validation. Ids deleted after saving simply match nothing.
- **API:** `views.list { teamId? }` (plain array, by name): with `teamId` only that team's views, without it every view (workspace and team); always shared views plus the caller's private ones. `views.get`, `views.create`, `views.update` (omitted fields unchanged; `filters` / `display` replace the whole object), `views.delete` (also deletes every user's favorite of it). Every change publishes an ID-only `view.updated` / `view.deleted`.
- **App:** the layers button next to the view tabs ("Save as view") opens a dialog with name, icon/color, scope (Workspace or a team, the page's team by default) and "Share with workspace", prefilled from the URL filters and the page's display options. `/:workspaceSlug/views` and `/:workspaceSlug/team/:key/views` list views (Name, Owner avatar, Scope). `/:workspaceSlug/view/:viewId` renders the list or board with the view's filters in the URL and its display options in a draft keyed `view:<id>`. Opening the page resets the draft display to the stored one. The filters too, unless the URL already has filters (a reload or a shared link of an edited view keeps them as unsaved changes). Any difference from the stored state (filter values compared regardless of order) shows "Unsaved changes · Save / Revert" in the header. Save is optimistic with rollback and is offered only to members who may edit the view; Revert restores the stored state. The view "…" menu has Rename…, Duplicate, Add to / Remove from favorites and Delete….

## Isolation invariants

- Every workspace-owned row has `workspaceId`; every query filters on it.
- An issue's `workspaceId` equals its team's `workspaceId`.
- A project, label, or assignee attached to an issue must belong to the same workspace (assignee must be a member).
- A GitHub repository belongs to exactly one workspace at a time.

## Users

- New teams add their creator as the first team member.
- Avatars are user-owned uploads; they are visible to the user and to anyone who shares a workspace with them. Replacing or removing an avatar marks the old upload `deleted` and enqueues object removal.
- A user with no workspace is sent to workspace setup after sign-in.
