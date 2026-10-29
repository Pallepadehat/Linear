# 0002 — Contract-first API with oRPC on Fastify

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

We want end-to-end type safety between a Vue SPA and a Node API, with runtime validation and a clean place for auth middleware.

## Decision

Define procedures in `packages/contract` using `@orpc/contract` + Zod. Implement them in `apps/api` with `implement(contract)` and serve via the oRPC `RPCHandler` mounted at `/rpc/*` on Fastify. The app uses `@orpc/client` with `@orpc/tanstack-query` + `@tanstack/vue-query`. Non-RPC routes are limited to Better Auth, the GitHub webhook, and health.

## Consequences

- The app depends only on the contract, never on API source.
- Input/output validated at runtime; types inferred, not duplicated.
- Fastify still gives us plugins (CORS, rate limiting), raw-body routes for webhooks, and pino logging.
- No public REST API in the MVP (oRPC's OpenAPI handler can add one later).

## Alternatives considered

- **tRPC** — router-first couples the client to server code; weaker contract separation.
- **REST + OpenAPI codegen** — more boilerplate, codegen step.
