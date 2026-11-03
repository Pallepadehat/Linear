import {
  DEFAULT_WORKFLOW_STATUSES,
  teamMembers,
  teams,
  workflowStatuses,
  workspaceMembers,
  type DbOrTx,
} from '@linear/db'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'
import { TEAM_KEY_PATTERN, normalizeTeamKey } from '../identifiers'
import { ISSUE_PRIORITIES, type IssuePriority } from '../issues/priorities'
import { pickDefaultStatus } from './default-status'

export type CreateTeamInput = {
  workspaceId: string
  name: string
  key: string
  /** Added as the first team member. */
  creatorId: string
}

export async function createTeam(db: DbOrTx, input: CreateTeamInput) {
  const key = normalizeTeamKey(input.key)
  if (!TEAM_KEY_PATTERN.test(key)) {
    throw new DomainError(
      'BAD_REQUEST',
      'Team key must be 2–10 letters or digits, starting with a letter',
    )
  }

  // A savepoint keeps a duplicate-key failure from aborting an outer transaction.
  try {
    return await db.transaction(async (tx) => {
      const [team] = await tx
        .insert(teams)
        .values({ workspaceId: input.workspaceId, name: input.name.trim(), key })
        .returning()
      if (!team) throw new Error('team insert returned no row')

      const statuses = await tx
        .insert(workflowStatuses)
        .values(
          DEFAULT_WORKFLOW_STATUSES.map((status, position) => ({
            workspaceId: input.workspaceId,
            teamId: team.id,
            name: status.name,
            category: status.category,
            position,
          })),
        )
        .returning()
      const defaultStatusId = pickDefaultStatus(statuses, null)?.id ?? null
      await tx.update(teams).set({ defaultStatusId }).where(eq(teams.id, team.id))
      await tx
        .insert(teamMembers)
        .values({ workspaceId: input.workspaceId, teamId: team.id, userId: input.creatorId })
      return { ...team, defaultStatusId }
    })
  } catch (error) {
    if (isUniqueViolation(error, 'teams_workspace_id_key_unique')) {
      throw new DomainError('CONFLICT', `Team key ${key} is already used in this workspace`)
    }
    throw error
  }
}

export async function listTeams(db: DbOrTx, workspaceId: string) {
  return db.select().from(teams).where(eq(teams.workspaceId, workspaceId)).orderBy(asc(teams.name))
}

export async function getTeamByKey(db: DbOrTx, workspaceId: string, key: string) {
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.workspaceId, workspaceId), eq(teams.key, normalizeTeamKey(key))))
  if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
  return team
}

/** Omitted fields are left unchanged. */
export type UpdateTeamDefaultsInput = {
  workspaceId: string
  teamId: string
  defaultStatusId?: string
  defaultPriority?: number
  defaultAssigneeId?: string | null
}

export async function updateTeamDefaults(db: DbOrTx, input: UpdateTeamDefaultsInput) {
  const changes: Partial<typeof teams.$inferInsert> = { updatedAt: new Date() }
  if (input.defaultStatusId !== undefined) {
    const [status] = await db
      .select({ id: workflowStatuses.id })
      .from(workflowStatuses)
      .where(
        and(
          eq(workflowStatuses.workspaceId, input.workspaceId),
          eq(workflowStatuses.teamId, input.teamId),
          eq(workflowStatuses.id, input.defaultStatusId),
        ),
      )
    if (!status) throw new DomainError('BAD_REQUEST', 'Status does not belong to this team')
    changes.defaultStatusId = status.id
  }
  if (input.defaultPriority !== undefined) {
    if (!ISSUE_PRIORITIES.includes(input.defaultPriority as IssuePriority)) {
      throw new DomainError('BAD_REQUEST', 'Priority must be between 0 and 4')
    }
    changes.defaultPriority = input.defaultPriority
  }
  if (input.defaultAssigneeId !== undefined) {
    if (input.defaultAssigneeId) {
      const [member] = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.defaultAssigneeId),
          ),
        )
      if (!member)
        throw new DomainError('BAD_REQUEST', 'Assignee is not a member of this workspace')
    }
    changes.defaultAssigneeId = input.defaultAssigneeId
  }

  const [team] = await db
    .update(teams)
    .set(changes)
    .where(and(eq(teams.workspaceId, input.workspaceId), eq(teams.id, input.teamId)))
    .returning()
  if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
  return team
}

export async function listWorkflowStatuses(db: DbOrTx, workspaceId: string, teamIds: string[]) {
  if (teamIds.length === 0) return []
  return db
    .select()
    .from(workflowStatuses)
    .where(
      and(eq(workflowStatuses.workspaceId, workspaceId), inArray(workflowStatuses.teamId, teamIds)),
    )
    .orderBy(asc(workflowStatuses.position))
}
