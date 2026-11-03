import {
  githubRepositories,
  issuePullRequestLinks,
  issues,
  pullRequests,
  teams,
  webhookDeliveries,
  workflowStatuses,
  type Db,
  type DbOrTx,
} from '@linear/db'
import { and, asc, eq, inArray, ne, or } from 'drizzle-orm'
import { z } from 'zod'
import { evaluate, type AutomationEvent, type LinkType, type PRState } from '../automation/evaluate'
import { updateIssue } from '../issues/issues.service'
import { parsePrIdentifiers } from './parse-identifiers'

const HANDLED_ACTIONS = new Set([
  'opened',
  'edited',
  'synchronize',
  'reopened',
  'ready_for_review',
  'converted_to_draft',
  'closed',
])

// Only the fields we use; GitHub sends many more.
const pullRequestEventSchema = z.object({
  action: z.string(),
  pull_request: z.object({
    id: z.number().int().positive(),
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    state: z.enum(['open', 'closed']),
    draft: z.boolean().nullish(),
    merged: z.boolean().nullish(),
    merged_at: z.string().nullable(),
    closed_at: z.string().nullable(),
    head: z.object({ ref: z.string() }),
  }),
  repository: z.object({ id: z.number().int().positive() }),
})

type PullRequestEvent = z.infer<typeof pullRequestEventSchema>
type PullRequestRow = typeof pullRequests.$inferSelect

export type DeliveryOutcome = 'processed' | 'ignored' | 'failed' | 'skipped'

/** An issue whose linked PRs or status this delivery changed, for realtime events and notifications. */
export type ChangedIssue = {
  issueId: string
  statusChanged: boolean
  /** The PR was newly linked to it (or its reference became closing). */
  linked: boolean
  /** Activity entries of the status changes automation made (the notifications' source). */
  statusActivityIds: string[]
  /** Projects whose activity feed got an entry (a milestone completed). */
  feedProjectIds: string[]
}

export type DeliveryResult = {
  outcome: DeliveryOutcome
  /** Set when the delivery was processed; the repository's workspace. */
  workspaceId: string | null
  /** Set when the delivery was processed. */
  pullRequestId: string | null
  changedIssues: ChangedIssue[]
}

/**
 * Applies one `pull_request` delivery in a single transaction: upsert the PR, recompute
 * its issue links, run automation, mark the delivery (docs/domain.md → Webhook processing).
 * Already handled deliveries are `skipped`, so retries and redeliveries have one effect.
 * Throws on unexpected errors; the caller marks the delivery failed and lets BullMQ retry.
 */
export async function processPullRequestDelivery(
  db: Db,
  deliveryId: string,
): Promise<DeliveryResult> {
  return db.transaction(async (tx): Promise<DeliveryResult> => {
    const [delivery] = await tx
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.deliveryId, deliveryId))
      .for('update')
    if (!delivery || delivery.status === 'processed' || delivery.status === 'ignored') {
      return { outcome: 'skipped', workspaceId: null, pullRequestId: null, changedIssues: [] }
    }
    const finish = async (
      status: Exclude<DeliveryOutcome, 'skipped'>,
      error?: string,
    ): Promise<DeliveryResult> => {
      await tx
        .update(webhookDeliveries)
        .set({ status, error: error ?? null })
        .where(eq(webhookDeliveries.id, delivery.id))
      return { outcome: status, workspaceId: null, pullRequestId: null, changedIssues: [] }
    }

    // A payload that doesn't parse never will; fail it without a retry.
    const parsed = pullRequestEventSchema.safeParse(delivery.payload)
    if (!parsed.success) return finish('failed', 'Malformed pull_request payload')
    const event = parsed.data
    if (!HANDLED_ACTIONS.has(event.action)) return finish('ignored')

    const [repository] = await tx
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.githubRepoId, event.repository.id))
    if (!repository) return finish('ignored')

    const { pullRequest, previousState } = await upsertPullRequest(tx, repository, event)
    // Links of a merged PR are frozen (docs/domain.md → GitHub PR linking).
    const { created, removedIssueIds } =
      previousState === 'merged'
        ? { created: [], removedIssueIds: [] }
        : await reconcileLinks(tx, pullRequest, event.pull_request.body)
    const moved = await automate(tx, pullRequest, previousState, created)

    // Every linked issue shows this PR (its title or state may have changed), and
    // issues it was just unlinked from no longer do.
    const linked = await tx
      .select({ issueId: issuePullRequestLinks.issueId })
      .from(issuePullRequestLinks)
      .where(
        and(
          eq(issuePullRequestLinks.workspaceId, pullRequest.workspaceId),
          eq(issuePullRequestLinks.pullRequestId, pullRequest.id),
        ),
      )
    const issueIds = new Set([...linked.map((l) => l.issueId), ...removedIssueIds])
    const newlyLinked = new Set(created.map((l) => l.issueId))
    const result = await finish('processed')
    return {
      ...result,
      workspaceId: pullRequest.workspaceId,
      pullRequestId: pullRequest.id,
      changedIssues: [...issueIds].sort().map((issueId) => ({
        issueId,
        statusChanged: moved.has(issueId),
        linked: newlyLinked.has(issueId),
        statusActivityIds: moved.get(issueId)?.activityIds ?? [],
        feedProjectIds: moved.get(issueId)?.feedProjectIds ?? [],
      })),
    }
  })
}

/** Marks a delivery failed after its transaction rolled back, unless it got processed meanwhile. */
export async function markDeliveryFailed(db: DbOrTx, deliveryId: string, error: string) {
  await db
    .update(webhookDeliveries)
    .set({ status: 'failed', error: error.slice(0, 1_000) })
    .where(
      and(eq(webhookDeliveries.deliveryId, deliveryId), ne(webhookDeliveries.status, 'processed')),
    )
}

/** "Merged" comes from GitHub's `merged` flag only; `closed` alone means closed without merge. */
function stateOf(pr: PullRequestEvent['pull_request']): PRState {
  if (pr.merged === true) return 'merged'
  if (pr.state === 'closed') return 'closed'
  return pr.draft ? 'draft' : 'open'
}

async function upsertPullRequest(
  tx: DbOrTx,
  repository: typeof githubRepositories.$inferSelect,
  event: PullRequestEvent,
): Promise<{ pullRequest: PullRequestRow; previousState: PRState | null }> {
  const pr = event.pull_request
  const values = {
    githubPrId: pr.id,
    repositoryId: repository.id,
    workspaceId: repository.workspaceId,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    branch: pr.head.ref,
    state: stateOf(pr),
    mergedAt: pr.merged === true && pr.merged_at ? new Date(pr.merged_at) : null,
    closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
  }

  const [inserted] = await tx
    .insert(pullRequests)
    .values(values)
    .onConflictDoNothing({ target: pullRequests.githubPrId })
    .returning()
  if (inserted) return { pullRequest: inserted, previousState: null }

  // The row lock orders concurrent deliveries for the same PR.
  const [existing] = await tx
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.githubPrId, pr.id))
    .for('update')
  if (!existing) throw new Error('pull request vanished during upsert')
  // `merged` is terminal: a late or out-of-order event never moves it back.
  if (existing.state === 'merged') return { pullRequest: existing, previousState: 'merged' }

  const [updated] = await tx
    .update(pullRequests)
    .set(values)
    .where(eq(pullRequests.id, existing.id))
    .returning()
  return { pullRequest: updated!, previousState: existing.state }
}

type CreatedLink = { issueId: string; type: LinkType }

/**
 * Makes the PR's links match the identifiers it mentions now. Only issues in the
 * repository's workspace can match. Returns links that are new or became `closing`,
 * and the issues whose link was removed.
 */
async function reconcileLinks(tx: DbOrTx, pr: PullRequestRow, body: string | null) {
  const candidates = parsePrIdentifiers({ branch: pr.branch, title: pr.title, body })
  const matches =
    candidates.length === 0
      ? []
      : await tx
          .select({ id: issues.id, teamKey: teams.key, number: issues.number })
          .from(issues)
          .innerJoin(teams, eq(teams.id, issues.teamId))
          .where(
            and(
              eq(issues.workspaceId, pr.workspaceId),
              or(
                ...candidates.map((c) =>
                  and(eq(teams.key, c.teamKey), eq(issues.number, c.number)),
                ),
              ),
            ),
          )
  const typeByIdentifier = new Map(candidates.map((c) => [`${c.teamKey}-${c.number}`, c.type]))
  const wanted = new Map(
    matches.map((m) => [m.id, typeByIdentifier.get(`${m.teamKey}-${m.number}`)!]),
  )

  const existing = await tx
    .select()
    .from(issuePullRequestLinks)
    .where(
      and(
        eq(issuePullRequestLinks.workspaceId, pr.workspaceId),
        eq(issuePullRequestLinks.pullRequestId, pr.id),
      ),
    )
  const staleLinks = existing.filter((link) => !wanted.has(link.issueId))
  const stale = staleLinks.map((link) => link.id)
  if (stale.length > 0) {
    await tx.delete(issuePullRequestLinks).where(inArray(issuePullRequestLinks.id, stale))
  }

  const created: CreatedLink[] = []
  for (const [issueId, type] of wanted) {
    const link = existing.find((l) => l.issueId === issueId)
    if (!link) {
      await tx
        .insert(issuePullRequestLinks)
        .values({ workspaceId: pr.workspaceId, issueId, pullRequestId: pr.id, type })
      created.push({ issueId, type })
    } else if (link.type !== type) {
      await tx
        .update(issuePullRequestLinks)
        .set({ type })
        .where(eq(issuePullRequestLinks.id, link.id))
      // A reference that becomes closing is a new closing relationship (rule A).
      if (type === 'closing') created.push({ issueId, type })
    }
  }
  return { created, removedIssueIds: staleLinks.map((link) => link.issueId) }
}

async function automate(
  tx: DbOrTx,
  pr: PullRequestRow,
  previousState: PRState | null,
  created: CreatedLink[],
) {
  const events = new Map<string, AutomationEvent[]>()
  const push = (issueId: string, event: AutomationEvent) =>
    events.set(issueId, [...(events.get(issueId) ?? []), event])

  for (const link of created) {
    push(link.issueId, { type: 'link_created', linkType: link.type, prState: pr.state })
  }
  // Closing without merge never moves an issue (rule E), so only merges need evaluating.
  if (pr.state === 'merged' && previousState !== 'merged') {
    const links = await tx
      .select()
      .from(issuePullRequestLinks)
      .where(
        and(
          eq(issuePullRequestLinks.workspaceId, pr.workspaceId),
          eq(issuePullRequestLinks.pullRequestId, pr.id),
        ),
      )
    for (const link of links) push(link.issueId, { type: 'pr_merged', linkType: link.type })
  }

  // A fixed order keeps concurrent deliveries from locking the same issues in opposite order.
  // Issue id → the status activity entries automation wrote for it, and the project feeds it touched.
  const moved = new Map<string, { activityIds: string[]; feedProjectIds: string[] }>()
  for (const issueId of [...events.keys()].sort()) {
    const result = await automateIssue(tx, pr, issueId, events.get(issueId)!)
    if (result.activityIds.length > 0) moved.set(issueId, result)
  }
  return moved
}

async function automateIssue(
  tx: DbOrTx,
  pr: PullRequestRow,
  issueId: string,
  events: AutomationEvent[],
) {
  const [issue] = await tx
    .select({ teamId: issues.teamId, category: workflowStatuses.category })
    .from(issues)
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(and(eq(issues.workspaceId, pr.workspaceId), eq(issues.id, issueId)))
    .for('update', { of: issues })
  if (!issue) return { activityIds: [], feedProjectIds: [] }

  const links = await tx
    .select({ type: issuePullRequestLinks.type, prState: pullRequests.state })
    .from(issuePullRequestLinks)
    .innerJoin(pullRequests, eq(pullRequests.id, issuePullRequestLinks.pullRequestId))
    .where(
      and(
        eq(issuePullRequestLinks.workspaceId, pr.workspaceId),
        eq(issuePullRequestLinks.issueId, issueId),
      ),
    )

  let category = issue.category
  const activityIds: string[] = []
  const feedProjectIds = new Set<string>()
  for (const event of events) {
    const result = evaluate({ category }, links, event)
    if (!result) continue
    const [status] = await tx
      .select({ id: workflowStatuses.id })
      .from(workflowStatuses)
      .where(
        and(
          eq(workflowStatuses.workspaceId, pr.workspaceId),
          eq(workflowStatuses.teamId, issue.teamId),
          eq(workflowStatuses.category, result.to),
        ),
      )
      .orderBy(asc(workflowStatuses.position))
      .limit(1)
    // A team without a status in that category has nothing to move to.
    if (!status) continue
    const updated = await updateIssue(tx, {
      workspaceId: pr.workspaceId,
      id: issueId,
      statusId: status.id,
      actor: { type: 'github', pullRequestId: pr.id },
    })
    category = result.to
    activityIds.push(...updated.activity.filter((a) => a.kind === 'status').map((a) => a.id))
    for (const projectId of updated.feedProjectIds) feedProjectIds.add(projectId)
  }
  return { activityIds, feedProjectIds: [...feedProjectIds] }
}
