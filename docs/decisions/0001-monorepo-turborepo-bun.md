# 0001 — Turborepo monorepo with Bun

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

The app, API, and worker share types, schemas, and domain logic. Separate repos would duplicate them or require publishing packages.

## Decision

One Turborepo monorepo with Bun workspaces: `apps/app`, `apps/api`, `apps/worker`, and shared `packages/*`. Bun is the package manager and runtime; server code avoids Bun-only APIs so it stays Node-compatible. Internal packages are named `@linear/<name>` and consumed as TypeScript source (no build step) where possible.

## Consequences

- One install, one lint/typecheck/test command, cached by Turborepo.
- Dependency direction must be enforced (see AGENTS.md).
- If a library misbehaves on Bun, we can run api/worker on Node without code changes.

## Alternatives considered

- **pnpm** — mature, but Bun gives faster installs and a built-in TS runtime.
- **Separate repos** — too much overhead for a small team.
