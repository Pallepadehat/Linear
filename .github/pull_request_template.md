## What

<!-- One or two sentences. -->

Fixes LIN-<!-- number -->
Roadmap: <!-- e.g. M2-01 -->

<!--
Linear links this PR through the issue ID (docs/workflow.md → Linear).
Placeholders below are not real IDs on purpose: Linear may parse IDs inside comments.
- Fixes / Closes / Resolves LIN-<n>  → In Progress on open, Done on merge
- Part of / Refs LIN-<n>             → linked, never moves to Done
- Several issues: "Fixes LIN-<a>, LIN-<b>"
- Stop a branch-name link: "skip LIN-<n>"
-->

## Why

<!-- Link PRD section / domain rule. -->

## How

<!-- Notable implementation choices, schema or contract changes. -->

## Verification

- [ ] `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] Migration generated and applies to a fresh DB (if schema changed)
- [ ] Auth + cross-workspace rejection tested (if new procedures)
- [ ] Checked in light **and** dark theme, keyboard only (if UI)
- [ ] Docs updated (`roadmap.md`, `domain.md`, ADR, `.env.example`) where relevant

## Assumptions / follow-ups

<!-- Anything ambiguous you decided, or work left for later. -->
