---
description: Close out the current roadmap task
---

1. Run /verify. Stop if anything fails.
2. Mark the task `[x]` in `docs/roadmap.md` and append a log line (`YYYY-MM-DD · ID · note`).
3. Update `docs/domain.md`, `docs/decisions/`, `.env.example`, or `AGENTS.md` if the change requires it (see "Document" in `docs/workflow.md`).
4. Draft a Conventional Commit message and a PR description using `.github/pull_request_template.md`, with `Fixes LIN-<n>` for the task's Linear issue. Do not commit or push unless asked.
