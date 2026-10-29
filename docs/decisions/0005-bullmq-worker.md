# 0005 — Background jobs with BullMQ in a separate worker

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

GitHub webhooks must be acknowledged fast and processed reliably and idempotently. Image processing is CPU-heavy. Neither belongs in the request path.

## Decision

BullMQ on Redis. The API only enqueues; `apps/worker` is a separate process that consumes queues (`github-webhooks`, `media`, `maintenance`, later `notifications`). Queue names and Zod payload schemas live in `packages/queue`. Webhook deliveries are persisted in Postgres **before** enqueueing, and jobs use the delivery ID as `jobId`.

## Consequences

- Webhook processing survives API restarts and retries with backoff.
- Worker can scale and crash independently of the API.
- One more process to run in dev (handled by `bun run dev`) and to deploy.

## Alternatives considered

- **Workers inside the API process** — simpler, but couples failure and CPU load.
- **pg-boss** (Postgres-based queue) — fewer services, but we want Redis for later caching/realtime too.
