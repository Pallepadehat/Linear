import { createHmac, randomUUID } from 'node:crypto'
import { createIssue } from '@linear/core'
import {
  activityLog,
  githubInstallations,
  githubRepositories,
  issuePullRequestLinks,
  issues,
  pullRequests,
  teams,
  webhookDeliveries,
  workflowStatuses,
} from '@linear/db'
import { createTeam, createUser, createWorkspace } from '@linear/db/testing'
import { createRealtimePublisher, createRedisConnection } from '@linear/queue'
import { createGithubWorker, createTestJobDeps } from '@linear/worker/testing'
import { and, eq } from 'drizzle-orm'
import { afterAll, expect, vi } from 'vitest'
import closedMerged from '../fixtures/github/pull_request.closed.merged.json'
import closedUnmerged from '../fixtures/github/pull_request.closed.unmerged.json'
import opened from '../fixtures/github/pull_request.opened.json'
import { setupTestApp } from '../harness'

/** The repository id in every fixture (`tip/app`). */
export const TIP_REPO_ID = opened.repository.id

const fixtures = {
  opened,
  'closed.merged': closedMerged,
  'closed.unmerged': closedUnmerged,
}

export type PullRequestOverrides = {
  repoId?: number
  /** GitHub's global PR id; distinct PRs need distinct ids. */
  id?: number
  number?: number
  branch?: string
  title?: string
  body?: string | null
}

/** A recorded `pull_request` payload with the fields a scenario cares about replaced. */
export function pullRequestEvent(
  name: keyof typeof fixtures,
  overrides: PullRequestOverrides = {},
) {
  const base = fixtures[name]
  const pr = base.pull_request
  const number = overrides.number ?? pr.number
  return {
    ...base,
    number,
    pull_request: {
      ...pr,
      id: overrides.id ?? pr.id,
      number,
      html_url: `https://github.com/tip/app/pull/${number}`,
      title: overrides.title ?? pr.title,
      body: overrides.body === undefined ? pr.body : overrides.body,
      head: { ...pr.head, ref: overrides.branch ?? pr.head.ref },
    },
    repository: { ...base.repository, id: overrides.repoId ?? base.repository.id },
  }
}

/**
 * The full GitHub path: the real app (webhook route → Postgres + Redis under the `test`
 * prefix) plus the real GitHub worker consuming that queue.
 */
export async function setupGithubAcceptance() {
  const { app, db } = await setupTestApp()
  const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379')
  // Real realtime events, so tests can watch automation reach open sockets.
  const deps = createTestJobDeps(db, createRealtimePublisher(connection))
  const worker = createGithubWorker(deps, connection, { prefix: 'test' })
  // Registered after the harness hooks, so it runs first: stop the worker before the DB closes.
  afterAll(async () => {
    await worker.close()
    connection.disconnect()
  })

  /** Signs `payload` with the test secret and posts it as GitHub would. */
  function post(payload: unknown, deliveryId: string) {
    const body = JSON.stringify(payload)
    const signature = createHmac('sha256', 'test-webhook-secret').update(body).digest('hex')
    return app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': deliveryId,
        'x-github-event': 'pull_request',
        'x-hub-signature-256': `sha256=${signature}`,
      },
      payload: body,
    })
  }

  async function deliveryStatus(deliveryId: string) {
    const [row] = await db
      .select({ status: webhookDeliveries.status })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.deliveryId, deliveryId))
    return row?.status
  }

  /**
   * Sends a new delivery and waits until the worker has finished it. Returns the
   * delivery id and its final status (`processed`, `ignored` or `failed`).
   */
  async function deliver(payload: unknown, deliveryId: string = randomUUID()) {
    const res = await post(payload, deliveryId)
    expect(res.statusCode).toBe(202)
    let status: string | undefined
    await vi.waitFor(
      async () => {
        status = await deliveryStatus(deliveryId)
        if (status === 'received') throw new Error('not processed yet')
      },
      { timeout: 10_000, interval: 25 },
    )
    return { deliveryId, status }
  }

  let sequence = 0

  /**
   * A workspace with team `key`, issue `<key>-200` in `status`, and repository `repoId`
   * connected to it through a GitHub App installation.
   */
  async function arrange({
    key = 'TIP',
    repoId = TIP_REPO_ID,
    status = 'Todo',
  }: { key?: string; repoId?: number; status?: string } = {}) {
    const user = await createUser(db)
    const workspace = await createWorkspace(db, { ownerId: user.id })
    const team = await createTeam(db, { workspaceId: workspace.id, key })
    await db.update(teams).set({ issueCounter: 199 }).where(eq(teams.id, team.id))
    const statusId = async (name: string) => {
      const [row] = await db
        .select()
        .from(workflowStatuses)
        .where(and(eq(workflowStatuses.teamId, team.id), eq(workflowStatuses.name, name)))
      return row!.id
    }
    const issue = await createIssue(db, {
      workspaceId: workspace.id,
      teamId: team.id,
      creatorId: user.id,
      title: 'Fix login',
      statusId: await statusId(status),
    })
    const [installation] = await db
      .insert(githubInstallations)
      .values({
        installationId: 5_000_000 + ++sequence,
        workspaceId: workspace.id,
        accountLogin: key.toLowerCase(),
      })
      .returning()
    await db.insert(githubRepositories).values({
      githubRepoId: repoId,
      workspaceId: workspace.id,
      installationId: installation!.id,
      fullName: `${key.toLowerCase()}/app`,
    })
    return { user, workspace, team, issue, statusId }
  }

  async function issueState(issueId: string) {
    const [row] = await db
      .select({
        status: workflowStatuses.name,
        completedAt: issues.completedAt,
        updatedAt: issues.updatedAt,
      })
      .from(issues)
      .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
      .where(eq(issues.id, issueId))
    return row!
  }

  const linksOf = (issueId: string) =>
    db
      .select({
        type: issuePullRequestLinks.type,
        number: pullRequests.number,
        state: pullRequests.state,
      })
      .from(issuePullRequestLinks)
      .innerJoin(pullRequests, eq(pullRequests.id, issuePullRequestLinks.pullRequestId))
      .where(eq(issuePullRequestLinks.issueId, issueId))
      .orderBy(pullRequests.number)

  const githubActivity = (issueId: string) =>
    db
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.issueId, issueId), eq(activityLog.actorType, 'github')))

  return { app, db, post, deliver, arrange, issueState, linksOf, githubActivity }
}
