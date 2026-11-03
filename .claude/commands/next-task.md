---
description: Pull the next ready issue from Linear (team LIN) and plan it
---

Issues live in Linear (workspace `LinearSchoolClone`, team `LIN`, project `Linear Clone — P0`). Titles start with the roadmap ID: `M2-08 · Issue detail page …`. Use the `linear` MCP tools.

1. **Pick the issue.**
   - If $ARGUMENTS names an issue (`LIN-14`) or roadmap ID (`M2-08`), use it (`get_issue`, or `list_issues` with `query: "M2-08"`).
   - Otherwise call `list_issues` with `team: "LIN"`, `assignee: "me"`, and state `Todo`, then `Backlog`. If none, repeat with `assignee: "null"` (unassigned). Never take an issue assigned to someone else unless $ARGUMENTS names it.
   - Order candidates by priority (Urgent → Low), then roadmap order.
   - An issue is ready only when every roadmap dependency (the `Depends on` column in `docs/roadmap.md` for its `M<x>-<yy>` ID) is done. Done means `[x]` in the roadmap **or** the dependency's Linear issue is `Done`; Linear wins if they disagree. Skip issues that aren't ready and say why.
2. **Read context.** `get_issue` for the full description and `list_comments` for discussion, then the PRD sections, `docs/domain.md` rules, and `AGENTS.md` sections relevant to it.
3. **Plan.** Show: the Linear issue (ID, title, URL), files to create/change, schema and contract changes, tests to add, open questions.
4. **Wait for approval.** Then:
   - In Linear: assign the issue to me and set its status to `In Progress` (`save_issue`).
   - Mark the roadmap task `[~]`.
   - Create the branch `<type>/lin-<n>-<slug>` from `develop` (not Linear's suggested `gitBranchName`).
   - Follow `docs/workflow.md`.
