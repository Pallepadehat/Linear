# Linear clone

A Linear-inspired issue tracker built as a school project. Teams track issues with statuses, priorities, assignees, labels and projects, and the core feature is the **GitHub integration**: a pull request that mentions an issue identifier (for example a branch named `tip-1-add-login`) is linked to that issue automatically. Opening the PR moves the issue to **In Progress**, and merging it moves the issue to **Done**.

| Light                                          | Dark                                         |
| ---------------------------------------------- | -------------------------------------------- |
| ![Issue list, light theme](docs/screenshots/issues-light.png) | ![Issue list, dark theme](docs/screenshots/issues-dark.png) |

**Stack:** Vue 3 + Vite + shadcn-vue + Tailwind (app) · Fastify + oRPC + Better Auth (api) · BullMQ workers on Redis · PostgreSQL + Drizzle · S3-compatible storage (RustFS) · Turborepo + Bun. The reasoning behind each choice is in [`docs/decisions/`](docs/decisions/).

**Contents**

- [Option A: try it with Docker only](#option-a-try-it-with-docker-only) (easiest, no Bun needed)
- [Option B: local development](#option-b-local-development)
- [Environment variables](#environment-variables)
- [Demo script](#demo-script)
- [GitHub App setup](#github-app-setup)
- [Production images and releases](#production-images-and-releases)
- [Troubleshooting](#troubleshooting)
- [Further reading](#further-reading)

---

## Option A: try it with Docker only

This runs the full production build: the app behind nginx, plus the api, worker, Postgres, Redis and object storage. Database migrations and the demo seed run automatically. You need **Docker** (Docker Desktop, or Docker Engine with the Compose plugin v2.20 or newer) and nothing else.

```bash
git clone https://github.com/Pallepadehat/Linear.git && cd Linear
cp .env.prod.example .env.prod
# Set the two secrets (any random strings work):
sed -i.bak "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|; \
  s|^GITHUB_WEBHOOK_SECRET=.*|GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 20)|" .env.prod && rm .env.prod.bak

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --wait
```

The first build takes a few minutes. When the command returns, open **http://localhost:8080** and sign in as **`demo@tip.dev` / `password123`**. Then follow the [demo script](#demo-script) (use the Docker commands).

- **Prebuilt images instead of building:** replace `up -d --build --wait` with `pull` followed by `up -d --wait`. This pulls the `:prod` images that CI publishes from `main` (see [Production images](#production-images-and-releases)).
- **Stop it:** `docker compose -f docker-compose.prod.yml --env-file .env.prod down`. Add `-v` to also delete the data.
- **Ports:** app `8080`, storage `8090` (the browser uploads files straight to storage). Change them with `APP_PORT`, `STORAGE_PORT`, `PUBLIC_URL` and `STORAGE_PUBLIC_URL` in `.env.prod`. The stack uses its own project name (`linear-prod`) and volumes, so it can run next to the development stack.

## Option B: local development

### Prerequisites

| Tool   | Version | Notes                                                      |
| ------ | ------- | ---------------------------------------------------------- |
| Bun    | 1.4.4   | `curl -fsSL https://bun.sh/install \| bash -s bun-v1.4.4`  |
| Node   | 22+     | Vite's config loader and `vue-tsc` run on Node             |
| Docker | any recent | Runs Postgres, Redis and object storage                  |

### Steps

```bash
git clone https://github.com/Pallepadehat/Linear.git && cd Linear
cp .env.example .env          # works as-is for local development
docker compose up -d          # Postgres, Redis, RustFS storage (+ creates the bucket)
bun install
bun run db:migrate            # apply database migrations
bun run db:seed               # demo user, workspace "Tip", team "TIP"
bun run dev                   # app + api + worker with hot reload
```

Open **http://localhost:5173** and sign in as **`demo@tip.dev` / `password123`**. You land on `/tip`.

Optional: `bun run db:seed:issues -- 200` adds 200 demo issues to TIP.

### Ports

| Service           | Port | Override (in `.env`)                     |
| ----------------- | ---- | ---------------------------------------- |
| App (Vite)        | 5173 | (fixed)                                  |
| API (Fastify)     | 3000 | `PORT`                                   |
| PostgreSQL        | 5432 | `POSTGRES_PORT` (+ update `DATABASE_URL`) |
| Redis             | 6379 | `REDIS_PORT` (+ update `REDIS_URL`)       |
| Storage (S3 API)  | 9000 | `STORAGE_PORT` (+ update `S3_ENDPOINT`)   |
| Storage console   | 9001 | `STORAGE_CONSOLE_PORT`                   |

In development the Vite server proxies `/api` and `/rpc` to the API, so the browser only talks to `:5173`. GitHub webhooks go to the API directly on `:3000`.

### Everyday commands

```bash
bun run lint && bun run typecheck && bun run test && bun run build   # what CI runs
bun run db:generate     # create a migration after changing packages/db/src/schema
bun run format          # prettier
```

Tests need the Docker services running. They use a separate `linear_test` database, which `docker compose up` creates. More in [`docs/testing.md`](docs/testing.md).

## Environment variables

Development reads one `.env` at the repo root, copied from [`.env.example`](.env.example). A blank value (`KEY=`) counts as unset. Server variables are validated at startup, and the process exits with a clear message if one is wrong.

| Variable | Used by | What it is |
| --- | --- | --- |
| `NODE_ENV` | api, worker | `development`, `test` or `production` |
| `LOG_LEVEL` | api, worker | pino log level (`info`, `debug`, …) |
| `POSTGRES_PORT` | docker compose | Host port for Postgres (default 5432) |
| `REDIS_PORT` | docker compose | Host port for Redis (default 6379) |
| `STORAGE_PORT` | docker compose | Host port for the S3 API (default 9000) |
| `STORAGE_CONSOLE_PORT` | docker compose | Host port for the storage web console (default 9001) |
| `DATABASE_URL` | api, worker, db scripts | Postgres connection string |
| `TEST_DATABASE_URL` | tests | Optional. Defaults to `DATABASE_URL` with the database renamed to `linear_test` |
| `REDIS_URL` | api, worker | Redis connection string (BullMQ queues) |
| `PORT` | api | API port (default 3000) |
| `BETTER_AUTH_SECRET` | api | Session signing secret, 32+ characters: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | api | Public URL the auth cookies belong to (the app URL) |
| `APP_URL` | api | Public app URL, used for CORS, trusted origins and the GitHub callback |
| `S3_ENDPOINT` | api, worker | S3 API URL the servers use |
| `S3_PUBLIC_ENDPOINT` | api, worker | Optional. S3 URL the *browser* uses for presigned upload/download links, when it differs from `S3_ENDPOINT` (Docker sets it) |
| `S3_REGION` | api, worker | S3 region (any value works for RustFS) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api, worker, compose | Storage credentials. Compose creates the storage server with them |
| `S3_BUCKET` | api, worker | Private bucket for uploads (default `linear-uploads`) |
| `GITHUB_APP_ID` | api, worker | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | api, worker | The App's private key (PEM). Newlines may be written as `\n` |
| `GITHUB_APP_SLUG` | api | The App's URL name, for the install link (`github.com/apps/<slug>`) |
| `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` | api | The App's OAuth credentials, used to verify installs ([ADR 0009](docs/decisions/0009-github-install-oauth-verification.md)) |
| `GITHUB_WEBHOOK_SECRET` | api, `demo:github` | Webhook HMAC secret. Every webhook is rejected (401) until this is set |
| `VITE_API_URL` | app (build) | Leave empty: the dev proxy (or nginx in Docker) serves the API on the app's origin |

The five `GITHUB_APP_*` values must be set together or not at all. Without them the app runs normally and the GitHub section in Settings explains that the App isn't configured. Only `VITE_*` variables reach the browser.

The Docker stack reads [`.env.prod.example`](.env.prod.example) instead (copied to `.env.prod`). It sets the internal URLs itself and adds `PUBLIC_URL`, `STORAGE_PUBLIC_URL`, `APP_PORT`, `SEED_DEMO`, `POSTGRES_PASSWORD`, `IMAGE_REGISTRY` and `IMAGE_TAG`. Each one is explained in that file.

## Demo script

This walks through the whole GitHub flow (PRD §12, Test 10). There are two ways to run it:

- **With a real GitHub App:** do the [GitHub App setup](#github-app-setup) first, then follow the "Real GitHub" lines.
- **Without GitHub:** `demo:github` connects a demo repository and sends correctly signed `pull_request` webhooks to the real endpoint. The signature check, queue, worker, linking and automation all run exactly as they would for GitHub. Follow the "Simulated" lines.

1. **Sign in** at the app URL as `demo@tip.dev` / `password123`.
2. **Create an issue.** Press <kbd>C</kbd> (or **New issue**), enter the title "Add login page" and create it. It gets the identifier **TIP-1** (or the next free number; use that number below) and starts in **Backlog**.
3. **Connect a repository.**
   - Real GitHub: **Settings → GitHub → Install**, choose the repository on GitHub, then click **Connect** next to it.
   - Simulated (dev): `bun run demo:github connect`
   - Simulated (Docker): `docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm github-demo connect`

   The repository `tip-demo/linear-demo` appears as connected in Settings → GitHub.
4. **Open a pull request** whose branch starts with the identifier:
   - Real GitHub: `git checkout -b tip-1-add-login && git commit --allow-empty -m "add login" && git push -u origin tip-1-add-login`, then open the PR.
   - Simulated (dev): `bun run demo:github open tip-1-add-login "TIP-1 Add login page"`
   - Simulated (Docker): `docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm github-demo open tip-1-add-login "TIP-1 Add login page"`

   **TIP-1 moves to In Progress** within a second or two. Reload the issue list to see it.
5. **Merge the pull request.**
   - Real GitHub: merge it on GitHub.
   - Simulated: the same command with `merge tip-1-add-login`.

   **TIP-1 moves to Done.**

Things worth showing as well:

- **Closing a PR without merging never completes an issue:** run `close tip-2-…` on an issue that is In Progress.
- **Manual status wins:** set an issue to Canceled by hand. A merged PR doesn't change it afterwards.
- `Fixes TIP-1` in a PR description also links and completes the issue. `Refs TIP-1` only links it. The full rules are in [`docs/domain.md`](docs/domain.md#github-pr-linking).

## GitHub App setup

You need a GitHub App once per deployment (one per developer for local development, because the webhook URL differs).

### 1. Get a public URL for webhooks

GitHub has to reach your machine. For local use, start a tunnel and keep it running:

```bash
# Cloudflare (no account needed): prints https://<random>.trycloudflare.com
cloudflared tunnel --url http://localhost:3000     # dev: straight to the API
cloudflared tunnel --url http://localhost:8080     # Docker: nginx forwards /webhooks to the API
# or: ngrok http 3000
```

Your **webhook URL** is `<tunnel URL>/webhooks/github`. Quick tunnels get a new URL on every start, so update the App when that happens.

### 2. Create the App

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App** (or the same under an organization):

| Field | Value |
| --- | --- |
| GitHub App name | Anything unique, e.g. `linear-clone-<you>`. Its URL name is your `GITHUB_APP_SLUG` |
| Homepage URL | Your app URL, e.g. `http://localhost:5173` |
| Callback URL | `<APP_URL>/setup/github`, e.g. `http://localhost:5173/setup/github` (Docker: `http://localhost:8080/setup/github`) |
| Request user authorization (OAuth) during installation | ✅ ticked (the install is verified with it) |
| Webhook → Active | ✅ |
| Webhook URL | `<tunnel URL>/webhooks/github` |
| Webhook secret | A random string: `openssl rand -hex 20`. This is your `GITHUB_WEBHOOK_SECRET` |
| Repository permissions | **Pull requests: Read-only**, **Metadata: Read-only** (selected automatically) |
| Subscribe to events | ✅ **Pull request** |
| Where can this App be installed? | Only on this account (or Any account) |

Create it. Then, on the App's page:

- Note the **App ID** → `GITHUB_APP_ID`, and the **Client ID** → `GITHUB_APP_CLIENT_ID`.
- **Generate a new client secret** → `GITHUB_APP_CLIENT_SECRET`.
- **Generate a private key** (downloads a `.pem`). Put it on one line with escaped newlines:

  ```bash
  awk 'NF {printf "%s\\n", $0}' ~/Downloads/your-app.*.private-key.pem
  ```

  Paste the output in quotes: `GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE…\n-----END RSA PRIVATE KEY-----\n"`

### 3. Configure and connect

1. Put the six `GITHUB_*` values in `.env` (dev) or `.env.prod` (Docker), then restart: `bun run dev`, or `docker compose … up -d` again.
2. In the app, go to **Settings → GitHub → Install** (owners only). GitHub asks which repositories to grant, then sends you back to `/setup/github`.
3. Click **Connect** next to a repository. From now on, its pull requests reach the issue tracker.

### Manual webhook fallback

- **No tunnel, or no GitHub at all:** use `demo:github` from the [demo script](#demo-script). It signs payloads with `GITHUB_WEBHOOK_SECRET`, exactly like GitHub does.
- **A delivery was missed** (tunnel down, URL changed): open the App's **Advanced → Recent Deliveries** on GitHub and click **Redeliver**. Deliveries are deduplicated by ID, so redelivering is always safe.
- **A repository webhook** (repo → Settings → Webhooks, content type `application/json`, same URL and secret, "Pull requests" event) also works for a repository that is already connected through the App. Events from repositories that aren't connected are stored and ignored.

## Production images and releases

`Dockerfile` has two targets:

- **`server`** runs the api (default command), the worker (`bun apps/worker/dist/index.js`) and the db scripts.
- **`app`** is nginx serving the built SPA. It proxies `/api`, `/rpc`, `/webhooks` and `/health` to the api, so everything shares one origin and auth cookies stay first-party.

[`docker-compose.prod.yml`](docker-compose.prod.yml) wires them together with Postgres, Redis and storage. The one-shot `migrate` service applies migrations, plus the demo seed unless `SEED_DEMO=false`, before the api and worker start.

The [Release workflow](.github/workflows/release.yml) builds both images and boots the full stack. It then smoke-tests health, the SPA, a demo login, an authenticated RPC call and webhook rejection:

| Event | Result |
| --- | --- |
| Pull request into `main` | Check `docker` must pass: the release builds and boots |
| Push to `main` (a release) | Same checks, then pushes `ghcr.io/pallepadehat/linear-server` and `linear-app` tagged **`:prod`** and **`:sha-<commit>`** |

GHCR packages start out private. To let anyone `pull` without `docker login ghcr.io`, set each package to public once (GitHub → your profile → Packages → package → Package settings → Change visibility).

`:prod` always points at the latest release, which `docker compose … pull` fetches. To pin or roll back, set `IMAGE_TAG=sha-<commit>` in `.env.prod`. For a real deployment, put the app behind HTTPS, set `PUBLIC_URL` / `STORAGE_PUBLIC_URL` to the public URLs, change the default passwords, and set `SEED_DEMO=false`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `port is already allocated` on `docker compose up` | Another project uses the port. Set `POSTGRES_PORT` etc. in `.env` and update the matching URL |
| `Database has N applied migration(s) that no longer exist` | Your local DB ran a migration that was renumbered. Run `docker compose down -v && docker compose up -d && bun run db:migrate && bun run db:seed` |
| `Invalid api environment: …` at startup | The message names the variable. Compare it with `.env.example` |
| Webhooks return 401 | `GITHUB_WEBHOOK_SECRET` isn't set, or differs from the App's webhook secret |
| PR opened but the issue didn't move | Check that the repository shows **Connected** in Settings → GitHub, that the branch or title starts with the identifier (`tip-1-…`), and that the issue is in Backlog or Todo. Automation never moves Done or Canceled issues |
| Upload fails in Docker from another machine | Set `PUBLIC_URL` and `STORAGE_PUBLIC_URL` to addresses that machine can reach, then `up -d` again |

## Further reading

- [`docs/prd.md`](docs/prd.md): scope, requirements and the acceptance tests
- [`docs/domain.md`](docs/domain.md): exact business rules (identifiers, statuses, PR linking, automation, roles)
- [`docs/design.md`](docs/design.md): the visual system, light and dark
- [`docs/roadmap.md`](docs/roadmap.md): what's done and what's next
- [`docs/workflow.md`](docs/workflow.md) and [`AGENTS.md`](AGENTS.md): how we work, branch rules, conventions
- [`docs/decisions/`](docs/decisions/): architecture decision records
