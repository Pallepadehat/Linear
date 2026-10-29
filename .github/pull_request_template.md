## What

<!-- One or two sentences. -->

Roadmap: <!-- e.g. M2-01 -->

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
