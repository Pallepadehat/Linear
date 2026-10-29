# 0006 — MinIO with presigned uploads

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

We store avatars, icons, and (P1) attachments. Streaming file bytes through the API wastes resources; public buckets leak data across workspaces.

## Decision

MinIO (S3-compatible) accessed via `@aws-sdk/client-s3` in `packages/storage`. One private bucket. The browser uploads directly with a presigned `PUT` after the API validates type and size and creates an `Upload` row; the client then confirms, and the worker processes images with sharp. Reads use short-lived presigned `GET` URLs issued after a membership check.

## Consequences

- API stays light; storage is swappable for AWS S3/R2 by changing env vars.
- Requires CORS configuration on the bucket and a cleanup job for unconfirmed uploads.
- Image URLs expire; the app must refetch them via queries (cache aligned with URL TTL).

## Alternatives considered

- **Upload through the API (multipart)** — simpler, but heavier and slower.
- **Public bucket** — breaks workspace isolation.
