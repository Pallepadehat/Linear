import { randomUUID } from 'node:crypto'
import { createIssue, receiveWebhookDelivery, updateIssue } from '@linear/core'
import {
  activityLog,
  createDb,
  githubInstallations,
  githubRepositories,
  issuePullRequestLinks,
  issues,
  pullRequests,
  teams,
  webhookDeliveries,
  workflowStatuses,
} from '@linear/db'
import {
  createTeam,
  createUser,
  createWorkspace,
  testDatabaseUrl,
  truncateAll,
} from '@linear/db/testing'
import { loadRootEnvFile } from '@linear/env'
import type { NotifyPayload, RealtimeEvent } from '@linear/queue'
import { createMemoryStorage } from '@linear/storage/testing'
import { and, eq } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { processGithubWebhook } from '../src/jobs/github/github-webhook'

loadRootEnvFile()
const { db, close } = createDb(testDatabaseUrl(), { max: 2 })
const published: { workspaceId: string; event: RealtimeEvent }[] = []
const notified: NotifyPayload[] = []
const deps = {
  db,
  storage: createMemoryStorage().storage,
  logger: pino({ level: 'silent' }),
  publish: async (workspaceId: string, event: RealtimeEvent) => {
    published.push({ workspaceId, event })
  },
  publishToUser: async () => {},
  notify: async (payload: NotifyPayload) => {
    notified.push(payload)
  },
}

beforeEach(async () => {
  published.length = 0
  notified.length = 0
  await truncateAll(db)
})
afterAll(close)

let sequence = 0

/** A workspace with team `key`, issue `<key>-200` in Todo, and a connected repository. */
async function arrange(key = 'TIP') {
  const user = await createUser(db)
  const workspace = await createWorkspace(db, { ownerId: user.id })
  const team = await createTeam(db, { workspaceId: workspace.id, key })
  await db.update(teams).set({ issueCounter: 199 }).where(eq(teams.id, team.id))
  const issue = await createIssue(db, {
    workspaceId: workspace.id,
    teamId: team.id,
    creatorId: user.id,
    title: 'Fix login',
  })
  const githubRepoId = ++sequence * 1_000
  const [installation] = await db
    .insert(githubInstallations)
    .values({ installationId: githubRepoId, workspaceId: workspace.id, accountLogin: 'tip' })
    .returning()
  await db.insert(githubRepositories).values({
    githubRepoId,
    workspaceId: workspace.id,
    installationId: installation!.id,
    fullName: 'tip/app',
  })
  const statusId = async (name: string) => {
    const [status] = await db
      .select()
      .from(workflowStatuses)
      .where(and(eq(workflowStatuses.teamId, team.id), eq(workflowStatuses.name, name)))
    return status!.id
  }
  return { user, workspace, team, issue, githubRepoId, statusId }
}

type PrFields = {
  githubPrId?: number
  number?: number
  branch?: string
  title?: string
  body?: string | null
  state?: 'open' | 'closed'
  merged?: boolean
  draft?: boolean
}

function payload(repoId: number, action: string, pr: PrFields = {}) {
  const merged = pr.merged ?? false
  const closed = merged || pr.state === 'closed'
  return {
    action,
    pull_request: {
      id: pr.githubPrId ?? 42,
      number: pr.number ?? 42,
      title: pr.title ?? 'Fix login validation',
      body: pr.body ?? null,
      html_url: `https://github.com/tip/app/pull/${pr.number ?? 42}`,
      state: closed ? 'closed' : 'open',
      draft: pr.draft ?? false,
      merged,
      merged_at: merged ? '2026-10-30T12:00:00Z' : null,
      closed_at: closed ? '2026-10-30T12:00:00Z' : null,
      head: { ref: pr.branch ?? 'tip-200-fix-login' },
    },
    repository: { id: repoId },
  }
}

/** Stores a delivery like the webhook route does and runs the job for it. */
async function deliver(body: Record<string, unknown>, deliveryId: string = randomUUID()) {
  await receiveWebhookDelivery(db, { deliveryId, event: 'pull_request', payload: body })
  await processGithubWebhook(deps, deliveryId)
  return deliveryId
}

async function issueState(id: string) {
  const [row] = await db
    .select({ status: workflowStatuses.name, completedAt: issues.completedAt })
    .from(issues)
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(eq(issues.id, id))
  return row!
}

const linksOf = (issueId: string) =>
  db
    .select({
      type: issuePullRequestLinks.type,
      pullRequestId: issuePullRequestLinks.pullRequestId,
    })
    .from(issuePullRequestLinks)
    .where(eq(issuePullRequestLinks.issueId, issueId))

const githubActivity = (issueId: string) =>
  db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.issueId, issueId), eq(activityLog.actorType, 'github')))

async function deliveryStatus(deliveryId: string) {
  const [row] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.deliveryId, deliveryId))
  return row!.status
}

describe('github-webhook job', () => {
  it('links a PR opened from tip-200-fix-login and moves the issue to In Progress (tests 3, 4)', async () => {
    const { issue, githubRepoId, statusId } = await arrange()

    const deliveryId = await deliver(payload(githubRepoId, 'opened'))

    expect(await deliveryStatus(deliveryId)).toBe('processed')
    const [pr] = await db.select().from(pullRequests)
    expect(pr).toMatchObject({ number: 42, state: 'open', branch: 'tip-200-fix-login' })
    expect(await linksOf(issue.id)).toEqual([{ type: 'closing', pullRequestId: pr!.id }])
    expect((await issueState(issue.id)).status).toBe('In Progress')
    expect(await githubActivity(issue.id)).toEqual([
      expect.objectContaining({
        kind: 'status',
        actorId: null,
        pullRequestId: pr!.id,
        from: await statusId('Backlog'),
        to: await statusId('In Progress'),
      }),
    ])
  })

  it('completes the issue when its only required PR merges (test 5)', async () => {
    const { issue, githubRepoId } = await arrange()
    await deliver(payload(githubRepoId, 'opened'))

    await deliver(payload(githubRepoId, 'closed', { merged: true }))

    expect(await issueState(issue.id)).toMatchObject({
      status: 'Done',
      completedAt: expect.any(Date),
    })
    const [pr] = await db.select().from(pullRequests)
    expect(pr).toMatchObject({ state: 'merged', mergedAt: expect.any(Date) })
  })

  it('does not complete the issue when the PR is closed without merge (test 6)', async () => {
    const { issue, githubRepoId } = await arrange()
    await deliver(payload(githubRepoId, 'opened'))

    await deliver(payload(githubRepoId, 'closed', { state: 'closed' }))

    expect((await issueState(issue.id)).status).toBe('In Progress')
    expect((await db.select().from(pullRequests))[0]!.state).toBe('closed')
  })

  it('waits for every required PR before completing (test 7)', async () => {
    const { issue, githubRepoId } = await arrange()
    const pr42 = { githubPrId: 42, number: 42 }
    const pr43 = { githubPrId: 43, number: 43, branch: 'feat/tip-200-tests' }
    await deliver(payload(githubRepoId, 'opened', pr42))
    await deliver(payload(githubRepoId, 'opened', pr43))

    await deliver(payload(githubRepoId, 'closed', { ...pr42, merged: true }))
    expect((await issueState(issue.id)).status).toBe('In Progress')

    await deliver(payload(githubRepoId, 'closed', { ...pr43, merged: true }))
    expect((await issueState(issue.id)).status).toBe('Done')
  })

  it('has one effect when a delivery arrives twice (test 8)', async () => {
    const { issue, githubRepoId } = await arrange()
    const body = payload(githubRepoId, 'opened')

    const deliveryId = await deliver(body)
    await processGithubWebhook(deps, deliveryId)
    // GitHub may also resend the same content under a new delivery id.
    await deliver(body)

    expect(await linksOf(issue.id)).toHaveLength(1)
    expect(await db.select().from(pullRequests)).toHaveLength(1)
    expect(await githubActivity(issue.id)).toHaveLength(1)
  })

  it('never touches issues in another workspace (test 9)', async () => {
    const { issue: theirs } = await arrange()
    // An unrelated workspace (team OPS) whose repository mentions TIP-200.
    const { githubRepoId } = await arrange('OPS')

    const deliveryId = await deliver(payload(githubRepoId, 'opened', { body: 'Fixes TIP-200' }))

    expect(await deliveryStatus(deliveryId)).toBe('processed')
    expect(await linksOf(theirs.id)).toEqual([])
    expect((await issueState(theirs.id)).status).toBe('Backlog')
  })

  it('ignores repositories that are not connected and actions it does not handle', async () => {
    const { issue, githubRepoId } = await arrange()

    const unknownRepo = await deliver(payload(999_999, 'opened'))
    const labeled = await deliver(payload(githubRepoId, 'labeled'))
    const malformed = await deliver({ action: 'opened', pull_request: { id: 'x' } })

    expect(await deliveryStatus(unknownRepo)).toBe('ignored')
    expect(await deliveryStatus(labeled)).toBe('ignored')
    expect(await deliveryStatus(malformed)).toBe('failed')
    expect(await linksOf(issue.id)).toEqual([])
    expect((await issueState(issue.id)).status).toBe('Backlog')
  })

  it('keeps a merged PR merged and its links frozen after late events', async () => {
    const { issue, githubRepoId } = await arrange()
    await deliver(payload(githubRepoId, 'opened'))
    await deliver(payload(githubRepoId, 'closed', { merged: true }))

    await deliver(payload(githubRepoId, 'reopened'))
    await deliver(payload(githubRepoId, 'edited', { branch: 'unrelated', title: 'Other work' }))

    expect((await db.select().from(pullRequests))[0]!.state).toBe('merged')
    expect(await linksOf(issue.id)).toHaveLength(1)
    expect((await issueState(issue.id)).status).toBe('Done')
  })

  it('treats references as links that never move the issue', async () => {
    const { issue, githubRepoId } = await arrange()
    const pr = { branch: 'cleanup', title: 'Cleanup', body: 'Refs TIP-200' }

    await deliver(payload(githubRepoId, 'opened', pr))
    await deliver(payload(githubRepoId, 'closed', { ...pr, merged: true }))

    expect(await linksOf(issue.id)).toEqual([expect.objectContaining({ type: 'reference' })])
    expect((await issueState(issue.id)).status).toBe('Backlog')
  })

  it('recomputes links on edit: removes stale ones, upgrades a reference to closing', async () => {
    const { issue, githubRepoId } = await arrange()
    const base = { branch: 'cleanup', title: 'Cleanup' }
    await deliver(payload(githubRepoId, 'opened', { ...base, body: 'see TIP-200' }))
    expect((await issueState(issue.id)).status).toBe('Backlog')

    await deliver(payload(githubRepoId, 'edited', { ...base, body: 'Fixes TIP-200' }))
    expect(await linksOf(issue.id)).toEqual([expect.objectContaining({ type: 'closing' })])
    expect((await issueState(issue.id)).status).toBe('In Progress')

    await deliver(payload(githubRepoId, 'edited', { ...base, body: null }))
    expect(await linksOf(issue.id)).toEqual([])
  })

  it('publishes realtime events for the issues it changed, after the commit', async () => {
    const { workspace, issue, githubRepoId } = await arrange()
    const event = (fields: string[]) => ({
      workspaceId: workspace.id,
      event: { type: 'issue.updated', issueId: issue.id, fields, actorId: null, originId: null },
    })

    const deliveryId = await deliver(payload(githubRepoId, 'opened'))
    await deliver(payload(githubRepoId, 'synchronize'))
    await deliver(payload(githubRepoId, 'closed', { merged: true }))
    // A redelivery is skipped and has no effect, so it publishes nothing.
    await processGithubWebhook(deps, deliveryId)

    expect(published).toEqual([
      event(['status', 'pullRequests']),
      event(['pullRequests']),
      event(['status', 'pullRequests']),
    ])
  })

  it('enqueues notify jobs for a new link and each automated status change', async () => {
    const { workspace, issue, githubRepoId } = await arrange()
    const opened = await deliver(payload(githubRepoId, 'opened'))
    await deliver(payload(githubRepoId, 'synchronize'))
    await deliver(payload(githubRepoId, 'closed', { merged: true }))
    await processGithubWebhook(deps, opened)

    const [pr] = await db.select().from(pullRequests)
    const statusEntries = (await githubActivity(issue.id)).map((a) => a.id)
    const base = { workspaceId: workspace.id, issueId: issue.id, actorId: null }
    expect(notified).toEqual([
      { ...base, event: 'pr_linked', deliveryId: opened, pullRequestId: pr!.id },
      { ...base, event: 'status_changed', activityId: statusEntries[0] },
      { ...base, event: 'status_changed', activityId: statusEntries[1] },
    ])
  })

  it('publishes for an issue a PR was unlinked from', async () => {
    const { issue, githubRepoId } = await arrange()
    const base = { branch: 'cleanup', title: 'Cleanup' }
    await deliver(payload(githubRepoId, 'opened', { ...base, body: 'see TIP-200' }))
    published.length = 0

    await deliver(payload(githubRepoId, 'edited', { ...base, body: null }))

    expect(published.map((p) => p.event)).toEqual([
      expect.objectContaining({ issueId: issue.id, fields: ['pullRequests'] }),
    ])
  })

  it('does not revert a manual status change on later events (rule F)', async () => {
    const { workspace, user, issue, githubRepoId, statusId } = await arrange()
    await deliver(payload(githubRepoId, 'opened'))
    await updateIssue(db, {
      workspaceId: workspace.id,
      id: issue.id,
      statusId: await statusId('Todo'),
      actor: { type: 'user', id: user.id },
    })

    await deliver(payload(githubRepoId, 'synchronize'))

    expect((await issueState(issue.id)).status).toBe('Todo')
  })
})
