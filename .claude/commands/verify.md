---
description: Run the full verification checklist for the current change
---

Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` from the repo root. Then walk through the "Verify" section of `docs/workflow.md` for what this change touched (schema, UI, API, jobs). Report each item as passed, failed (with output), or not applicable. Do not mark anything passed that you did not run.
