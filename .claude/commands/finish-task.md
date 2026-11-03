---
description: Close out the current roadmap task
---

1. Run /verify. Stop if anything fails.
2. Mark the task `[x]` in `docs/roadmap.md` and append a log line (`YYYY-MM-DD · ID · note`).
3. Update `docs/domain.md`, `docs/decisions/`, `.env.example`, or `AGENTS.md` if the change requires it (see "Document" in `docs/workflow.md`).
4. Draft a Conventional Commit message and a PR description using `.github/pull_request_template.md`, with `Fixes LIN-<n>` for the task's Linear issue. Do not commit or push unless asked.
5. Leave the Linear status alone: opening the PR moves the issue to In Progress and merging moves it to Done (Linear's GitHub integration). If the work changed scope, add a short comment on the Linear issue (`save_comment`).
