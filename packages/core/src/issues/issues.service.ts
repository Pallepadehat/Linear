import { issues, teams, workflowStatuses, workspaceMembers, type DbOrTx } from '@linear/db'
import { and, asc, eq, sql } from 'drizzle-orm'
import { DomainError } from '../errors'
import { nextCompletedAt } from './completed-at'

/** 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low (docs/domain.md → Priorities). */
export const ISSUE_PRIORITIES = [0, 1, 2, 3, 4] as const
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number]

const DEFAULT_STATUS_NAME = 'Todo'

export type CreateIssueInput = {
  workspaceId: string
  teamId: string
  creatorId: string
  title: string
  description?: string | null
  /** Defaults to the team's `Todo` status (or its first `unstarted` one). */
  statusId?: string
  priority?: number
  assigneeId?: string | null
  projectId?: string | null
}

export async function createIssue(db: DbOrTx, input: CreateIssueInput) {
  const title = input.title.trim()
  if (title.length === 0) throw new DomainError('BAD_REQUEST', 'Issue title is required')
  const priority = input.priority ?? 0
  if (!ISSUE_PRIORITIES.includes(priority as IssuePriority)) {
    throw new DomainError('BAD_REQUEST', 'Priority must be between 0 and 4')
  }

  const status = await resolveStatus(db, input.workspaceId, input.teamId, input.statusId)
  if (input.assigneeId) await assertWorkspaceMember(db, input.workspaceId, input.assigneeId)

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
        assigneeId: input.assigneeId ?? null,
        creatorId: input.creatorId,
        projectId: input.projectId ?? null,
        completedAt: nextCompletedAt(status.category, null),
      })
      .returning()
    if (!issue) throw new Error('issue insert returned no row')
    return issue
  })
}

async function resolveStatus(
  db: DbOrTx,
  workspaceId: string,
  teamId: string,
  statusId: string | undefined,
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

  // Prefer `Todo` by name; fall back to the first `unstarted` status if it was renamed.
  const candidates = await db
    .select()
    .from(workflowStatuses)
    .where(and(scope, eq(workflowStatuses.category, 'unstarted')))
    .orderBy(asc(workflowStatuses.position))
  const status = candidates.find((s) => s.name === DEFAULT_STATUS_NAME) ?? candidates[0]
  if (!status) throw new DomainError('NOT_FOUND', 'Team not found')
  return status
}

async function assertWorkspaceMember(db: DbOrTx, workspaceId: string, userId: string) {
  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
  if (!member) throw new DomainError('BAD_REQUEST', 'Assignee is not a member of this workspace')
}
