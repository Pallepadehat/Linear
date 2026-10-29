import {
  DEFAULT_WORKFLOW_STATUSES,
  teamMembers,
  teams,
  workflowStatuses,
  type DbOrTx,
} from '@linear/db'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'
import { TEAM_KEY_PATTERN, normalizeTeamKey } from '../identifiers'

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

      await tx.insert(workflowStatuses).values(
        DEFAULT_WORKFLOW_STATUSES.map((status, position) => ({
          workspaceId: input.workspaceId,
          teamId: team.id,
          name: status.name,
          category: status.category,
          position,
        })),
      )
      await tx
        .insert(teamMembers)
        .values({ workspaceId: input.workspaceId, teamId: team.id, userId: input.creatorId })
      return team
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
