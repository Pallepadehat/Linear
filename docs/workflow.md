# Workflow

How a task moves from "next up" to merged. Applies to humans and agents.

## 1. Pick

- Take the first ready task in [`roadmap.md`](roadmap.md) (all dependencies done), or the task you were given.
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
| `main`    | Production                  | Protected: changes only via PR, CI (`ci`) must pass, no force push, no deletion |
| `develop` | Development (default branch) | Cannot be deleted                                           |
| feature   | One roadmap task            | Branch off `develop`, PR back into `develop`                 |

- Feature branches: `<type>/<roadmap-id>-<short-slug>`, e.g. `feat/m2-01-issue-identifiers`, `fix/m4-05-duplicate-links`.
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

Use the template in `.github/pull_request_template.md`. Title follows the commit format. Link the roadmap ID. Target `develop` (only release and hotfix PRs target `main`). CI runs on every PR via `.github/workflows/ci.yml`.

## Writing an ADR

Copy [`decisions/0000-template.md`](decisions/0000-template.md) to the next number. Write one when a choice is hard to reverse, affects several packages, or someone would reasonably ask "why did we do it this way?". ADRs are never edited after acceptance — supersede them with a new one.
