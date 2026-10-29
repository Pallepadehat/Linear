# 0003 — Drizzle ORM for PostgreSQL

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

We need typed queries, migrations, transactions with row-level control (atomic issue counters), and a Better Auth adapter.

## Decision

Drizzle ORM with drizzle-kit migrations in `packages/db`. Schema in TypeScript; migrations generated and committed. Zod schemas for DB rows can be derived with `drizzle-zod` where useful.

## Consequences

- SQL-like API makes `UPDATE … RETURNING` counters and scoped queries explicit.
- No generated client or engine binary; works well in a monorepo and on Bun.
- Migrations must be reviewed; never edited after being applied.

## Alternatives considered

- **Prisma** — heavier, client generation, less control over SQL.
- **Kysely** — great query builder but no schema/migration story built in.
