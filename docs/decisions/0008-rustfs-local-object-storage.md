# 0008 — RustFS as the local S3 server

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

ADR 0006 chose MinIO for object storage. MinIO no longer publishes community Docker images (`minio/minio` is gone from Docker Hub), so `docker compose up` cannot start it.

## Decision

Run [RustFS](https://github.com/rustfs/rustfs) (`rustfs/rustfs`, Apache-2.0, S3-compatible) as the `storage` service in `docker-compose.yml`, with a one-shot `amazon/aws-cli` container that creates the private bucket and its CORS rule. Everything else from ADR 0006 stands: the code only speaks the S3 API through `@aws-sdk/client-s3` (path-style), uploads use presigned PUTs, reads use presigned GETs.

## Consequences

- No code depends on the server; MinIO, AWS S3 or R2 work by changing the `S3_*` env vars.
- Docs that say "MinIO" mean "the S3-compatible store"; env names stay `S3_*`.

## Alternatives considered

- **Pinning an old MinIO image from a mirror** — unmaintained and not reproducible.
- **LocalStack** — heavier, and S3 is all we need.
