import {
  issueLabels,
  issues,
  projects,
  labels,
  teams,
  workflowStatuses,
  workspaceMembers,
  type DbOrTx,
} from '@linear/db'
import { and, asc, desc, eq, inArray, lt, sql, type SQL } from 'drizzle-orm'
import { recordActivity, type ActivityActor } from '../activity/activity.service'
import { diffIssue } from '../activity/diff'
import { assertCursor } from '../cursor'
import { DomainError } from '../errors'
import { pickDefaultStatus } from '../teams/default-status'
import { nextCompletedAt } from './completed-at'
import { ISSUE_PRIORITIES, type IssuePriority } from './priorities'

export type CreateIssueInput = {
  workspaceId: string
  teamId: string
  creatorId: string
  title: string
  description?: string | null
  /** Omitted status, priority and assignee use the team's issue defaults (domain.md). */
  statusId?: string
  priority?: number
  /** `null` leaves the issue unassigned even when the team has a default assignee. */
  assigneeId?: string | null
  projectId?: string | null
  labelIds?: string[]
}

/** Omitted fields are left unchanged; `labelIds` replaces the whole set. */
export type UpdateIssueInput = {
  workspaceId: string
  id: string
  actor: ActivityActor
  title?: string
  description?: string | null
  statusId?: string
  priority?: number
  assigneeId?: string | null
  projectId?: string | null
  labelIds?: string[]
}

export type ListIssuesInput = {
  workspaceId: string
  teamId?: string
  projectId?: string
  assigneeId?: string
  creatorId?: string
  cursor?: string | null
  limit: number
}

export type IssueRecord = Awaited<ReturnType<typeof loadIssues>>[number]

function normalizeTitle(title: string) {
  const trimmed = title.trim()
  if (trimmed.length === 0) throw new DomainError('BAD_REQUEST', 'Issue title is required')
  return trimmed
}

function assertPriority(priority: number) {
  if (!ISSUE_PRIORITIES.includes(priority as IssuePriority)) {
    throw new DomainError('BAD_REQUEST', 'Priority must be between 0 and 4')
  }
}

export async function createIssue(db: DbOrTx, input: CreateIssueInput) {
  const title = normalizeTitle(input.title)
  const [teamDefaults] = await db
    .select({
      statusId: teams.defaultStatusId,
      priority: teams.defaultPriority,
      assigneeId: teams.defaultAssigneeId,
    })
    .from(teams)
    .where(and(eq(teams.id, input.teamId), eq(teams.workspaceId, input.workspaceId)))
  if (!teamDefaults) throw new DomainError('NOT_FOUND', 'Team not found')

  const priority = input.priority ?? teamDefaults.priority
  assertPriority(priority)
  const status = await resolveStatus(
    db,
    input.workspaceId,
    input.teamId,
    input.statusId ?? null,
    teamDefaults.statusId,
  )
  let assigneeId = input.assigneeId ?? null
  if (input.assigneeId === undefined && teamDefaults.assigneeId) {
    // A default assignee who has since left the workspace is skipped, not an error.
    assigneeId = (await isWorkspaceMember(db, input.workspaceId, teamDefaults.assigneeId))
      ? teamDefaults.assigneeId
      : null
  } else if (assigneeId) {
    await assertWorkspaceMember(db, input.workspaceId, assigneeId)
  }
  if (input.projectId) await assertProject(db, input.workspaceId, input.projectId)
  const labelIds = await resolveLabelIds(db, input.workspaceId, input.labelIds ?? [])

  return db.transaction(async (tx) => {
    // The row lock on the team serializes concurrent creates, so numbers are
    // gap-free per transaction that commits and never reused after a delete.
    const [team] = await tx
      .update(teams)
      .set({ issueCounter: sql`${teams.issueCounter} + 1` })
      .where(and(eq(teams.id, input.teamId), eq(teams.workspaceId, input.workspaceId)))
      .returning({ number: teams.issueCounter })
    if (!team) throw new DomainError('NOT_FOUND', 'Team not found')

    const [issue] = await tx
      .insert(issues)
      .values({
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        number: team.number,
        title,
        description: input.description ?? null,
        statusId: status.id,
        priority,
        assigneeId,
        creatorId: input.creatorId,
        projectId: input.projectId ?? null,
        completedAt: nextCompletedAt(status.category, null),
      })
      .returning()
    if (!issue) throw new Error('issue insert returned no row')
    await setIssueLabels(tx, input.workspaceId, issue.id, labelIds)
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: issue.id,
      actor: { type: 'user', id: input.creatorId },
      changes: [{ kind: 'created', from: null, to: null }],
    })
    return issue
  })
}

export async function getIssue(db: DbOrTx, workspaceId: string, id: string) {
  const [issue] = await loadIssues(db, workspaceId, eq(issues.id, id))
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
  return issue
}

/** `teamKey` is expected uppercase (identifier lookups are case-insensitive upstream). */
export async function getIssueByIdentifier(
  db: DbOrTx,
  workspaceId: string,
  teamKey: string,
  number: number,
) {
  const [issue] = await loadIssues(
    db,
    workspaceId,
    and(eq(teams.key, teamKey.toUpperCase()), eq(issues.number, number)),
  )
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
  return issue
}

/**
 * Newest first. UUIDv7 ids are time-ordered and unique, so the last id of a
 * page is a stable cursor: issues created later sort before it and never
 * shift the pages after it.
 */
export async function listIssues(db: DbOrTx, input: ListIssuesInput) {
  assertCursor(input.cursor)
  const rows = await loadIssues(
    db,
    input.workspaceId,
    and(
      input.teamId ? eq(issues.teamId, input.teamId) : undefined,
      input.projectId ? eq(issues.projectId, input.projectId) : undefined,
      input.assigneeId ? eq(issues.assigneeId, input.assigneeId) : undefined,
      input.creatorId ? eq(issues.creatorId, input.creatorId) : undefined,
      input.cursor ? lt(issues.id, input.cursor) : undefined,
    ),
    input.limit + 1,
  )
  const items = rows.slice(0, input.limit)
  const nextCursor = rows.length > input.limit ? (items.at(-1)?.id ?? null) : null
  return { items, nextCursor }
}

export async function updateIssue(db: DbOrTx, input: UpdateIssueInput) {
  await db.transaction(async (tx) => {
    // Locking the row keeps `completedAt` consistent with concurrent status changes.
    const [current] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.workspaceId, input.workspaceId), eq(issues.id, input.id)))
      .for('update')
    if (!current) throw new DomainError('NOT_FOUND', 'Issue not found')

    // Always bumped, so a labels-only change still counts as an update.
    const changes: Partial<typeof issues.$inferInsert> = { updatedAt: new Date() }
    if (input.title !== undefined) changes.title = normalizeTitle(input.title)
    if (input.description !== undefined) changes.description = input.description
    if (input.priority !== undefined) {
      assertPriority(input.priority)
      changes.priority = input.priority
    }
    if (input.statusId !== undefined) {
      const status = await resolveStatus(
        tx,
        input.workspaceId,
        current.teamId,
        input.statusId,
        null,
      )
      changes.statusId = status.id
      changes.completedAt = nextCompletedAt(status.category, current.completedAt)
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) await assertWorkspaceMember(tx, input.workspaceId, input.assigneeId)
      changes.assigneeId = input.assigneeId
    }
    if (input.projectId !== undefined) {
      if (input.projectId) await assertProject(tx, input.workspaceId, input.projectId)
      changes.projectId = input.projectId
    }

    const labelIds =
      input.labelIds === undefined
        ? undefined
        : await resolveLabelIds(tx, input.workspaceId, input.labelIds)
    const currentLabels = await tx
      .select({ labelId: issueLabels.labelId })
      .from(issueLabels)
      .where(
        and(eq(issueLabels.workspaceId, input.workspaceId), eq(issueLabels.issueId, current.id)),
      )
    const activity = diffIssue(
      { ...current, labelIds: currentLabels.map((row) => row.labelId) },
      { ...changes, labelIds },
    )

    await tx.update(issues).set(changes).where(eq(issues.id, current.id))
    if (labelIds !== undefined) {
      await tx
        .delete(issueLabels)
        .where(
          and(eq(issueLabels.workspaceId, input.workspaceId), eq(issueLabels.issueId, current.id)),
        )
      await setIssueLabels(tx, input.workspaceId, current.id, labelIds)
    }
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: current.id,
      actor: input.actor,
      changes: activity,
    })
  })
  return getIssue(db, input.workspaceId, input.id)
}

export async function deleteIssue(db: DbOrTx, workspaceId: string, id: string) {
  const [issue] = await db
    .delete(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
    .returning({ id: issues.id })
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
  return issue
}

/** Issues with their team key, status and labels, scoped to the workspace. */
async function loadIssues(db: DbOrTx, workspaceId: string, where: SQL | undefined, limit?: number) {
  const query = db
    .select({ issue: issues, teamKey: teams.key, status: workflowStatuses })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(and(eq(issues.workspaceId, workspaceId), where))
    .orderBy(desc(issues.id))
  const rows = limit === undefined ? await query : await query.limit(limit)
  if (rows.length === 0) return []

  const attached = await db
    .select({ issueId: issueLabels.issueId, label: labels })
    .from(issueLabels)
    .innerJoin(labels, eq(labels.id, issueLabels.labelId))
    .where(
      and(
        eq(issueLabels.workspaceId, workspaceId),
        inArray(
          issueLabels.issueId,
          rows.map((row) => row.issue.id),
        ),
      ),
    )
    .orderBy(asc(labels.name))

  return rows.map(({ issue, teamKey, status }) => ({
    ...issue,
    identifier: `${teamKey}-${issue.number}`,
    status,
    labels: attached.filter((row) => row.issueId === issue.id).map((row) => row.label),
  }))
}

async function resolveLabelIds(db: DbOrTx, workspaceId: string, labelIds: string[]) {
  const unique = [...new Set(labelIds)]
  if (unique.length === 0) return unique
  const found = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, unique)))
  if (found.length !== unique.length) throw new DomainError('BAD_REQUEST', 'Label not found')
  return unique
}

async function setIssueLabels(
  db: DbOrTx,
  workspaceId: string,
  issueId: string,
  labelIds: string[],
) {
  if (labelIds.length === 0) return
  await db
    .insert(issueLabels)
    .values(labelIds.map((labelId) => ({ workspaceId, issueId, labelId })))
}

async function assertProject(db: DbOrTx, workspaceId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
  if (!project) throw new DomainError('BAD_REQUEST', 'Project not found')
}

async function resolveStatus(
  db: DbOrTx,
  workspaceId: string,
  teamId: string,
  statusId: string | null,
  defaultStatusId: string | null,
) {
  const scope = and(
    eq(workflowStatuses.workspaceId, workspaceId),
    eq(workflowStatuses.teamId, teamId),
  )

  if (statusId) {
    const [status] = await db
      .select()
      .from(workflowStatuses)
      .where(and(scope, eq(workflowStatuses.id, statusId)))
    if (!status) throw new DomainError('BAD_REQUEST', 'Status does not belong to this team')
    return status
  }

  const statuses = await db.select().from(workflowStatuses).where(scope)
  const status = pickDefaultStatus(statuses, defaultStatusId)
  if (!status) throw new DomainError('BAD_REQUEST', 'Team has no status for new issues')
  return status
}

async function isWorkspaceMember(db: DbOrTx, workspaceId: string, userId: string) {
  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
  return Boolean(member)
}

async function assertWorkspaceMember(db: DbOrTx, workspaceId: string, userId: string) {
  if (!(await isWorkspaceMember(db, workspaceId, userId))) {
    throw new DomainError('BAD_REQUEST', 'Assignee is not a member of this workspace')
  }
}
