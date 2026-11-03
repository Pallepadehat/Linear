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
- The create issue dialog preselects the project when opened from a project page. Until the issue detail page exists (M2-08), the project picker lives in the create issue dialog; M2-08 reuses `ProjectPicker` in its properties sidebar.
- The issue detail page lives at `/:workspaceSlug/issue/:identifier`; the identifier is case-insensitive (`tip-200` opens TIP-200). An unknown or malformed identifier, or an issue in another workspace, shows the same "Issue not found" state. Clicking a list row opens it (the title is a link stretched over the row; the row's pickers sit above it).
- On the detail page, sidebar property changes save immediately through the same `useUpdateIssue()` mutation as the list rows (its patch also covers title, description and project; every settled change also refetches project progress). The title saves on blur or Enter (Esc reverts); the description uses the same markdown editor as the create dialog (rather than a plain textarea, so stored markdown and attachments render) and saves when focus leaves it, or once pending uploads finish, or when leaving the page.
- The detail timeline merges comments and activity oldest first. Activity names are resolved from current statuses, members, labels and projects; ids that no longer exist read as "a removed status/user/label/project". GitHub entries read as "GitHub". Comment bodies show as plain text for now; editing and deleting comments in the UI is not part of M2-08.
- `issues.list` returns `{ items, nextCursor }`, page size 50 by default (max 100). `teamId` / `projectId` are the page's scope; the user's filters are multi-value lists: `statusIds`, `priorities`, `assigneeIds` and `projectIds` (`null` in the list = unassigned / no project) and `labelIds` (issues with **any** of the labels). Values within one filter are OR, different filters AND; an empty list doesn't filter; ids from elsewhere match nothing.
- `q` matches the title case-insensitively as a literal substring (`%` and `_` aren't wildcards), **or** an exact identifier like `tip-12` (case-insensitive, same team key + number). No full-text or trigram index yet: the title match is a scan within the workspace, fine at P0 sizes.
- Sorts: `createdAt` (default), `updatedAt`, `priority`; `direction` `desc` (default) is newest / most urgent first, `asc` the reverse. Priority sorts Urgent → Low for `desc` and Low → Urgent for `asc`; No priority is last in both. Ties break by id, newest first for priority and in the sort's direction for dates.
- Pagination is keyset: the cursor is opaque (base64url of the sort, the last row's sort value and its id). Timestamps travel as epoch microseconds computed in Postgres so no row is skipped or repeated at millisecond ties. A cursor issued for another sort or direction is `BAD_REQUEST`. Issues inserted or edited elsewhere in the order never shift the pages after a cursor.
- The list and board views store filters, search and sort in the route query so reloads and shared links restore the view: `?status=<ids>&priority=1,2&assignee=<ids|none>&project=<ids|none>&label=<ids>&q=…&sort=priority&dir=asc` (comma-separated; defaults omitted; malformed values are dropped, not errors). Updates replace the history entry. Search applies 250 ms after typing stops. Statuses are per team, so the workspace-wide filter merges same-named statuses (each team's `Todo`) into one option that selects all their ids; `teams.list` returns each team's statuses for this. A project page hides the project filter. Scope params (`assignee: 'me'`, `creator: 'me'`, `teamId`, `projectId`) combine with the filters by AND.
- My Issues (the workspace landing page) lists issues in the current workspace across all teams, with two tabs: **Assigned** (default, `issues.list` with `assignee: 'me'`) and **Created** (`creator: 'me'`). `'me'` is resolved to the session user on the server, so a client can't list another user's issues this way. The active tab is in the URL (`?tab=created`; Assigned has no param). The empty state's "Create issue" opens the create dialog, preassigned to the current user from the Assigned tab.
- Issue view tabs (team issues and All issues pages): **All issues** (default, no category filter), **Active** (`started` + `unstarted`) and **Backlog** (`backlog`), in Linear's order. Completed and canceled issues show only under All issues. The tab is `?view=active|backlog` (All issues has no param; unknown values fall back to All issues), sent to `issues.list` as `statusCategories`, which combines with `statusIds` and every other filter by AND (an empty list doesn't filter). Switching tabs **pushes** a history entry (back/forward walks the tabs) and keeps the filter params; Clear filters keeps the tab. No counts on the tabs. My Issues keeps its own Assigned / Created tabs and has no view tabs; project pages have none. On the board, a tab hides the empty columns of other categories (an issue just moved out keeps its column until the list refetches). A teammate's status change refetches tabbed lists, since it can move an issue between tabs.
- The view toolbar (under the page header) holds the tabs on the left and round icon buttons on the right: Filter (`F`, opens the filter menu; ignored while typing), Display options (placeholder until M7-03) and Details (`⌘ I`, toggles `issueDetailsOpen` in the UI store; the panel itself is M7-05). Filter chips, search and sort stay in the filter bar below it.
- Descriptions are stored as **markdown** (CommonMark + GFM task lists) with Linear's extensions: `+++ Title … +++` collapsible sections, `$$ … $$` LaTeX blocks, ```` ```mermaid ```` diagrams and `attachment:` references (see Uploads). The editor reads and writes markdown; an empty editor saves no description (`null`). An issue can't be submitted while attachments are still uploading.
- The issue list groups loaded issues by status, keyed by category + name so the workspace-wide list merges each team's `Todo` into one group. Groups are ordered `started`, `unstarted`, `backlog`, `completed`, `canceled`, then by status position; issues keep the list's sort order within a group. Group counts show loaded issues until every page is fetched (the next page loads on scroll).
- Status, priority, assignee and labels change in place from issue rows through one `useUpdateIssue()` mutation: the change is written to every cached copy of the issue (each loaded list page and the `get`/`getByIdentifier` detail entries) before the request, rolled back with a toast if it fails, and the lists, details and activity are refetched once the last in-flight change settles. Changing status moves the row to its new group immediately; entering `completed` sets `completedAt` optimistically (cleared when leaving it). A row's status picker offers its own team's statuses. Row pickers have no global hotkey (it couldn't tell rows apart) and show labels only when the issue has some; adding the first label waits for the detail page (M2-08), which reuses the same mutation.
- The team and All issues pages switch between **List** and **Board** with a toggle in the panel header; the choice is one per-browser preference (`issue-layout` in localStorage via the Pinia preferences store), not per page. My Issues and project pages stay list-only.
- The board has one column per status in workflow order (`backlog`, `unstarted`, `started`, `completed`, `canceled`, then position), keyed by category + name like the list groups, so the All issues board merges each team's `Todo`. Every status of the loaded teams gets a column, empty ones included; a team board waits for its statuses before rendering. Cards keep the list's sort order; the board has the same filter bar as the list. The board loads every page in the background (columns are only complete once all pages are in) and virtualizes each column.
- Dropping a card on a column moves the issue to its **own team's** status with that column's category + name, through the same optimistic `useUpdateIssue()` (rollback + toast on error). A column the dragged issue's team has no status for doesn't accept the drop; dropping on the current column does nothing. The keyboard alternative is the card's status picker (Tab to it, Enter, pick the status), which offers the issue team's statuses.

- **Assignee picker** (one shared `AssigneePicker` in the create dialog, issue detail, list rows and board cards): rows are **No assignee** (`0`), the current user (`1`), then a **Team members** section with everyone else sorted by name (`2`–`9` for the first eight). Teams have no separate membership: every workspace member belongs to every team, so the team's members are `workspaces.listMembers` and no `teamId` input is needed. The filter matches name and email (case-insensitive); digits pick a row only while the filter is empty. Rows keep the shared 32px picker height and "Assign to..." placeholder from `design.md` (it wins over the issue's 28px).

## Activity

- Every issue change is logged in `activity_log`, in the same transaction as the change: `created` on create, then one entry per field whose value actually changed. Setting a field to the value it already had (including the same label set in another order, or a title that trims to the current one) writes nothing.
- Actor is `user` (with `actorId`) for changes made through the API, `github` (no `actorId`, with `pullRequestId` of the triggering PR) for automation. A deleted user's entries keep `actorType: user` with `actorId` null.
- `from`/`to` per kind: `title` text; `status`, `assignee`, `project` ids (or null); `priority` number; `labels` sorted label-id arrays. Ids are stored rather than names, so renamed statuses and labels show their current names. `created` and `description` carry no values (description text is not copied into the log).
- `activity.list` returns one issue's entries **oldest first** as `{ items, nextCursor }`, cursor = last entry id (UUIDv7), page size 50 (max 100). An issue outside the workspace is `NOT_FOUND`.

## Comments

- Comments belong to one issue and are deleted with it (`comments.issue_id` cascades). Bodies are markdown, trimmed, 1–50 000 characters; a blank body is `BAD_REQUEST`.
- Only the author may edit a comment; anyone else (owners included) gets `FORBIDDEN`. The author may delete their own comment, and workspace owners may delete anyone's (see Roles); other members get `FORBIDDEN`.
- An edited comment keeps `createdAt` and gets a new `updatedAt`; saving the same body is a no-op. Edits and deletes are not written to `activity_log`.
- `comments.list` returns one issue's comments **oldest first** as `{ items, nextCursor }`, cursor = last comment id (UUIDv7), page size 50 (max 100). Each comment carries its author's `id`, `name` and `avatarUrl`. An issue or comment outside the workspace is `NOT_FOUND`.

## Realtime events

Open clients learn about changes as they happen (ADR 0011). Events are hints, not data: they carry IDs and the client refetches what it shows.

- **Events:** `issue.created`, `issue.updated` (with `fields`: any of `title`, `description`, `status`, `priority`, `assignee`, `project`, `labels`, `pullRequests`), `issue.deleted`, `comment.created`, `comment.updated`, `comment.deleted`. Each has `issueId` and `actorId` (the user, or `null` for GitHub automation); comment events add `commentId`. `template.updated` (create, edit or delete of an issue template) carries `templateId` and `actorId` instead of `issueId`. Schemas: `packages/contract` (client DTO) and `packages/queue` (Redis bus, same shape plus the internal `originId`).
- **Who publishes:** the API after a successful `issues.create`/`update`/`delete` and `comments.create`/`update`/`delete`; the worker after a `pull_request` delivery commits, one `issue.updated` per issue whose links or status it changed (`fields` = `pullRequests`, plus `status` when automation moved it). Skipped redeliveries publish nothing. `issue.updated.fields` lists the fields the request set, even if a value didn't change.
- **Channel:** Redis pub/sub `workspace:<workspaceId>`. Every API instance subscribes to a workspace's channel while one of its sockets watches that workspace.
- **Who receives:** only sockets subscribed through `realtime.subscribe`, which requires a session and workspace membership (`requireWorkspace`; non-members get `NOT_FOUND` and no events). The upgrade at `/rpc/ws` is rejected with `401` without a session and `403` for a foreign `Origin`. Membership is checked when subscribing; there is no member removal yet, so it isn't rechecked mid-stream.
- **Echoes:** each browser tab has a random client id, sent as `x-client-id` on every request and with the subscription. Events caused by a tab are not sent back to that tab (it already applied them optimistically). Other tabs of the same user do receive them.
- **Delivery:** best effort, at most once, no replay. A failed publish is logged and never fails the change. Clients reconnect with backoff (1 s doubling to 30 s, jittered) and refetch their active queries after a reconnect.
- **Client handling:** `issue.updated` fetches that issue once and patches it into every cached list and detail copy (skipped while the tab has its own edit in flight, which refetches when it settles); lists refetch, coalesced, only on create or when `assignee`/`project` changed (membership of My Issues and project views); other changes refetch only the filtered or sorted lists they can affect (`status` → status filter, `priority` → priority filter or sort, `labels` → label filter, `title` → search, any change → `updatedAt` sort); deletes drop the issue from lists; comment events refetch that issue's comments; `template.updated` refetches the template lists.
- **Not covered yet:** presence, collaborative editing, notifications.

- **Client handling:** `issue.updated` fetches that issue once and patches it into every cached list and detail copy (skipped while the tab has its own edit in flight, which refetches when it settles); lists refetch, coalesced, only on create or when `assignee`/`project` changed (membership of My Issues and project views); other changes refetch only the filtered or sorted lists they can affect (`status` → status filter, `priority` → priority filter or sort, `labels` → label filter, `title` → search, any change → `updatedAt` sort); deletes drop the issue from lists; comment events refetch that issue's comments.
- **Not covered yet:** collaborative editing, notifications.

## Presence

Who is online and which issue they're looking at. Ephemeral: Redis only, no table, nothing in the activity log.

- **Heartbeat:** `presence.heartbeat { workspaceSlug, viewingIssueId: uuid | null, state: 'active' | 'away' }`, sent by each tab every 20 s, when the viewed issue changes, when the tab is hidden/shown (`away` while hidden), and on (re)connect. It is accepted only over the realtime WebSocket, from a socket currently subscribed to that workspace (`realtime.subscribe`), with membership checked by `requireWorkspace` (non-members `NOT_FOUND`). A heartbeat over HTTP, from a socket not subscribed to the workspace, or naming an issue outside the workspace is dropped silently (no error, nothing stored).
- **Storage:** `presence:<workspaceId>:<userId>` is a hash of the user's live connections (one per socket) → `{ state, viewingIssueId, at }`, key TTL 60 s refreshed per heartbeat; `presence:<workspaceId>` is a sorted set of userIds scored by expiry, used for listing; `presence:<workspaceId>:seen` keeps each user's last heartbeat time (no TTL) for "last seen". A connection with no heartbeat for 60 s counts as gone; expired users are pruned when the list is read.
- **Merging tabs:** a user is `active` if any live connection is active, else `away`; `viewingIssueId` comes from the most recent active connection (else the most recent one).
- **Disconnect:** closing a socket removes that connection right away; the user goes offline when their last connection is gone.
- **Events:** `presence.changed { userId }` on `workspace:<id>` when a user's merged state or viewed issue changes, when a socket closes and that changes it, and for users pruned as expired on read. Clients refetch `presence.list`; it also refetches every 60 s to catch tabs that died without closing.
- **`presence.list`:** members only (`requireWorkspace`); returns `{ userId, state: 'active' | 'away' | 'offline', viewingIssueId, lastSeenAt }` for **current members** with a live connection or a known last-seen time. Entries for non-members (e.g. removed members) are never returned.
- **UI:** avatars show a green (`success`) dot for active, a hollow `ink-subtle` dot for away, nothing for offline; the dot is ringed in the surrounding surface color (`--avatar-ring`, default `panel`; the spec's "canvas ring" taken as "the surface behind the avatar"). The issue detail header shows the other members viewing the issue (you are excluded): up to 3 stacked avatars + "+N", tooltip "<name> is viewing". Settings → Members shows "Online" / "Away" / "Last seen …" / "Offline".

## Labels

- Labels are workspace-wide (shared by all teams). Any member may create, rename, recolor or delete them.
- Names are trimmed, 1–80 characters, and unique per workspace (exact match, so `Bug` and `bug` can coexist); a duplicate is `CONFLICT`.
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

## App shell

- Sidebar sections (Workspace, Your teams, Favorites) start expanded; each team row starts collapsed and expands when one of its pages is opened. The state is per browser (`sidebar-sections` in localStorage), never server data.
- `team/:teamKey` redirects to `team/:teamKey/issues`. The team Projects page lists the workspace projects whose `teamIds` include the team (client-side filter of `projects.list`).
- Until the command menu (M7-11) lands, the sidebar Search button focuses the issue search field, opening All issues first when the current page has none. Until M10-02, Inbox and the notifications bell open an empty inbox page and the unread badge is hidden (count 0). Views pages are placeholders until M10-05; Favorites stays hidden until M8-07.
- The content panel keeps the `panel` surface and light-mode panel shadow from design.md → App shell (design.md wins over the issue's `bg-surface-1` / no-shadow wording).

## Isolation invariants

- Every workspace-owned row has `workspaceId`; every query filters on it.
- An issue's `workspaceId` equals its team's `workspaceId`.
- A project, label, or assignee attached to an issue must belong to the same workspace (assignee must be a member).
- A GitHub repository belongs to exactly one workspace at a time.

## Users

- New teams add their creator as the first team member.
- Avatars are user-owned uploads; they are visible to the user and to anyone who shares a workspace with them. Replacing or removing an avatar marks the old upload `deleted` and enqueues object removal.
- A user with no workspace is sent to workspace setup after sign-in.
