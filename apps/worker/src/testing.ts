// Entry point for other workspaces' tests (apps/api acceptance tests run the real
// GitHub worker against the webhook route). Never imported at runtime.
export type { JobDeps } from './deps'
export { createGithubWorker } from './workers/github.worker'
