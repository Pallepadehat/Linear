# 0011 — Realtime updates: oRPC over WebSocket with Redis pub/sub

- **Status:** Accepted
- **Date:** 2026-11-03

## Context

Changes made by teammates, or by GitHub automation in the worker, only showed up after a reload or a refetch. Linear updates every open tab within about a second. The transport has to stay contract-first (AGENTS.md allows no ad-hoc app-data routes), authenticate with the Better Auth cookie, never leak events across workspaces, keep working with more than one API instance, and accept events from the worker, which has no sockets of its own.

## Decision

- **Transport:** `realtime.subscribe` is an oRPC procedure whose output is an `eventIterator` of Zod-typed events. It is served by oRPC's `ws` adapter at `/rpc/ws` (`@fastify/websocket`), with the same router and middleware as `/rpc/*`. The upgrade is refused without a session (401) or from a foreign `Origin` (403); `requireWorkspace` runs before the first event.
- **Fan-out:** the API and the worker publish ID-only events to Redis pub/sub channel `workspace:<id>` after their transaction commits. Each API instance holds one subscriber connection and subscribes to a channel only while a local socket watches that workspace (reference counted), then hands events to its sockets through oRPC's in-process `EventPublisher`.
- **Client:** one socket per open workspace (`useRealtime` in `WorkspaceLayout`). Events update TanStack Query caches via the oRPC keys; reconnects back off and refetch active queries because missed events are not replayed. A per-tab client id suppresses echoes of the tab's own optimistic changes.

## Consequences

- No new infrastructure: Redis is already required for BullMQ.
- Delivery is at most once. That's acceptable because events only trigger refetches and clients resync after reconnecting, but nothing should rely on seeing every event.
- Proxies must pass WebSocket upgrades: the Vite dev proxy (`ws: true`) and nginx (`location = /rpc/ws` with `Upgrade` headers and a long read timeout). The API pings every 25 s to keep idle sockets open.
- The bus schema (`packages/queue`) and the client DTO (`packages/contract`) are defined twice because the worker may not import the contract; the API's `toClientEvent` makes drift a type error.

## Alternatives considered

- **Event iterator over HTTP streaming (SSE) on `/rpc`:** no proxy changes, but one long-lived HTTP request per tab, and the issue asked for WebSockets, which also leave room for presence later.
- **Postgres `LISTEN/NOTIFY`:** no Redis involvement, but each API instance would hold a dedicated DB connection and payloads are limited; Redis is already the cross-process bus.
- **Polling:** simplest, but either slow or expensive for large boards.
