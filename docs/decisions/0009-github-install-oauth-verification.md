# 0009 — Verify GitHub installations with OAuth during install

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

After a GitHub App install, GitHub redirects back with `installation_id` and our `state` as plain query parameters. A signed `state` proves which workspace and user started the flow, but not that the user has anything to do with the installation id that comes back. Installation ids are sequential numbers, so a workspace owner could finish the flow with someone else's id and receive that organization's pull request titles and links in their workspace.

## Decision

The App has "Request user authorization (OAuth) during installation" turned on, so the callback also carries an OAuth `code`. `github.completeInstall` exchanges it for a user token and only accepts the installation if it appears in `GET /user/installations` for that user. The `state` is an HMAC (keyed with `BETTER_AUTH_SECRET`, domain-separated) over workspace id, user id and a 10-minute expiry, and must belong to the caller.

GitHub calls go through a `GitHubAppClient` interface in `packages/core/src/github` (Octokit `@octokit/app` underneath), injected into `buildApp()` so tests use a fake and the worker can reuse it.

## Consequences

- An installation can only be attached by someone whose GitHub account can access it; the first workspace to attach it owns it (`CONFLICT` for others).
- The api needs `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` in addition to the App id, key and slug. All five are required together.
- The App's Callback URL must be `$APP_URL/setup/github`.
- The OAuth code is single-use: reloading the callback page fails with a "try again" message.

## Alternatives considered

- **Signed state only** — simplest, but lets anyone claim a guessed installation id.
- **Signed state + "installation created after the state"** — no extra secrets, but blocks re-linking an installation that already exists (users would have to uninstall and reinstall).
