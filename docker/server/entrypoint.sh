#!/bin/sh
# Zero-config secrets for docker-compose.prod.yml: a secret that isn't passed in is generated
# once into the `secrets` volume and reused by every container and restart, so the stack runs
# with no .env file. Secrets passed as env vars (e.g. a real GitHub App's) always win.
set -eu

secret() {
  file="/secrets/$1"
  if [ ! -s "$file" ]; then
    # Write then rename, so a concurrent reader never sees a half-written file.
    head -c 32 /dev/urandom | base64 | tr -d '\n' > "$file.tmp.$$"
    mv "$file.tmp.$$" "$file"
  fi
  cat "$file"
}

if [ -d /secrets ]; then
  if [ -z "${BETTER_AUTH_SECRET:-}" ]; then BETTER_AUTH_SECRET=$(secret better-auth-secret); fi
  if [ -z "${GITHUB_WEBHOOK_SECRET:-}" ]; then GITHUB_WEBHOOK_SECRET=$(secret github-webhook-secret); fi
  export BETTER_AUTH_SECRET GITHUB_WEBHOOK_SECRET
fi

exec "$@"
