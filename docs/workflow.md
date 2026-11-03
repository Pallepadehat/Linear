# Workflow

How a task moves from "next up" to merged. Applies to humans and agents.

## 1. Pick

- Take the first ready task in [`roadmap.md`](roadmap.md) (all dependencies done), or the task you were given.
- Every roadmap task has a Linear issue in team `LIN` (title `M2-01 · …`). Assign it to yourself; it moves to In Progress when the PR opens (see [Linear](#linear)).
- Mark it `[~]`.
- One task per branch/PR. If a task is bigger than ~400 changed lines (excluding generated files), split it into new roadmap tasks first.

## 2. Understand

Read before writing code:

1. The relevant PRD section and acceptance criteria.
2. [`domain.md`](domain.md) for any business rule involved.
3. The rules in [`AGENTS.md`](../AGENTS.md) for the layers you'll touch.
4. Existing code in the same module — match its patterns.

If a requirement is ambiguous: pick the simplest interpretation consistent with the docs, state it in the PR, and record it in `domain.md`. Ask only when the choice is hard to reverse (schema shape, public contract, security).

## 3. Plan

For anything beyond a small change, write a short plan first (in the PR description or the session): files to touch, schema/contract changes, tests to add. Order of work follows [AGENTS.md → How to add a feature](../AGENTS.md#how-to-add-a-feature-end-to-end): schema → contract → core → api → jobs → app → tests.

## 4. Build

- Small, focused commits.
- Write the test with the logic, not afterwards — especially for `packages/core`.
- Don't refactor unrelated code in the same PR; note it in the roadmap instead.

## 5. Verify

Before calling a task done:

```bash
bun run lint && bun run typecheck && bun run test && bun run build
```

Plus, depending on the change:

- **Schema:** `bun run db:generate` produced a migration and it applies to a fresh DB.
- **UI:** checked in the browser, in **light and dark**, with keyboard only.
- **API:** an unauthorized and a cross-workspace request are rejected (test it).
- **Jobs:** running the same job twice has one effect.

Report results honestly: if something fails or was skipped, say so.

## 6. Document

- Mark the roadmap task `[x]` and add a log line.
- Changed a business rule? Update `domain.md`.
- Made a significant technical choice? Add an ADR in `decisions/`.
- New env var? Update `.env.example` and PRD §8.13.
- New command or convention? Update `AGENTS.md`.

## 7. Ship

### Branches

| Branch    | Purpose                     | Rules                                                        |
| --------- | --------------------------- | ------------------------------------------------------------ |
| `main`    | Production                  | Protected: changes only via PR, checks `ci` and `docker` must pass, no force push, no deletion |
| `develop` | Development (default branch) | Cannot be deleted                                           |
| feature   | One roadmap task            | Branch off `develop`, PR back into `develop`                 |

- Feature branches: `<type>/lin-<n>-<short-slug>`, e.g. `feat/lin-5-issue-schema`, `fix/lin-42-duplicate-links`. The `lin-<n>` part links the PR to the Linear issue.
- Releases: open a PR from `develop` → `main` once `develop` is stable. Merging it is a production release.
- Hotfixes: `hotfix/<slug>` off `main`, PR into `main`, then merge `main` back into `develop`.
- Never commit directly to `main`.

### Commits — Conventional Commits

```
<type>(<scope>): <summary in imperative, lowercase>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`.
- Scopes: `app`, `api`, `worker`, `contract`, `db`, `core`, `queue`, `storage`, `env`, `docs`, `repo`.
- Example: `feat(core): allocate issue numbers atomically`.
- No AI attribution or `Co-Authored-By` trailers for AI tools in commits or PRs.

### Pull requests

Use the template in `.github/pull_request_template.md`. Title follows the commit format. Put `Fixes LIN-<n>` in the description and link the roadmap ID. Target `develop` (only release and hotfix PRs target `main`). CI runs on every PR via `.github/workflows/ci.yml`; PRs into `main` also run `.github/workflows/release.yml` (check `docker`: build the production images and smoke-test the stack), and a push to `main` publishes them to GHCR as `:prod` and `:sha-<commit>`; `.github/workflows/linear.yml` fails a PR into `develop` that has no Linear issue ID in its branch, title, or description.

### Linear

The repo is connected to Linear through Linear's GitHub integration. A PR is linked to an issue when `LIN-<n>` appears in the branch name, the PR title, or the PR description:

| Write in the PR description         | Effect                                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| `Fixes LIN-5` (also `Closes`, `Resolves`, `Implements`) | Linked; issue → In Progress on open, Done on merge |
| `Part of LIN-5` (also `Refs`, `Contributes to`)        | Linked; moves through the workflow but never to Done |
| `Related to LIN-5`                  | Linked only, no status change                                 |
| `Fixes LIN-5, LIN-6`                | Links several issues to one PR                                |
| `skip LIN-5`                        | Prevents a link (e.g. one coming from the branch name)        |

- An issue split over several PRs moves to Done only when the last linked PR merges. Use `Part of` on all but the final PR.
- Magic words in PR comments don't link anything; edit the title or description of an open PR instead.
- Don't put closing magic words in commit messages: the PR is what drives status.
- A GitHub autolink turns `LIN-<n>` in PRs and comments into a link to `https://linear.app/linearschoolclone/issue/LIN-<n>`.

## Writing an ADR

Copy [`decisions/0000-template.md`](decisions/0000-template.md) to the next number. Write one when a choice is hard to reverse, affects several packages, or someone would reasonably ask "why did we do it this way?". ADRs are never edited after acceptance — supersede them with a new one.
