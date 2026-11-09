import { and, eq, sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import type { DbOrTx } from '../client'
import { DEFAULT_WORKFLOW_STATUSES } from '../defaults'
import {
  issues,
  teamMembers,
  teams,
  users,
  workflowStatuses,
  workspaceMembers,
  workspaces,
} from '../schema'

// Factories insert rows directly and return them. They bypass domain services on
// purpose, so tests can arrange state the services would refuse to create.

let sequence = 0
const next = () => ++sequence

export async function createUser(db: DbOrTx, overrides: Partial<typeof users.$inferInsert> = {}) {
  const n = next()
  const [user] = await db
    .insert(users)
    .values({ name: `User ${n}`, email: `user${n}-${uuidv7()}@example.test`, ...overrides })
    .returning()
  return user!
}

export async function createWorkspace(
  db: DbOrTx,
  input: { ownerId: string } & Partial<typeof workspaces.$inferInsert>,
) {
  const n = next()
  const { ownerId, ...overrides } = input
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: `Workspace ${n}`,
      slug: `ws-${n}-${uuidv7().slice(-8)}`,
      createdById: ownerId,
      ...overrides,
    })
    .returning()
  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace!.id, userId: ownerId, role: 'owner' })
  return workspace!
}

export async function addMember(
  db: DbOrTx,
  workspaceId: string,
  userId: string,
  role: 'owner' | 'member' = 'member',
) {
  const [member] = await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role })
    .returning()
  return member!
}

export async function createTeam(
  db: DbOrTx,
  input: { workspaceId: string; memberIds?: string[] } & Partial<typeof teams.$inferInsert>,
) {
  const { memberIds = [], ...overrides } = input
  const [team] = await db
    .insert(teams)
    .values({ name: 'Team', key: `T${next()}`, ...overrides })
    .returning()
  await db.insert(workflowStatuses).values(
    DEFAULT_WORKFLOW_STATUSES.map((s, position) => ({
      workspaceId: team!.workspaceId,
      teamId: team!.id,
      name: s.name,
      category: s.category,
      position,
    })),
  )
  if (memberIds.length > 0) {
    await db
      .insert(teamMembers)
      .values(
        memberIds.map((userId) => ({ workspaceId: team!.workspaceId, teamId: team!.id, userId })),
      )
  }
  return team!
}

/** Inserts an issue in the team's first status, bumping the team counter for its number. */
export async function createIssue(
  db: DbOrTx,
  input: { teamId: string; creatorId: string } & Partial<typeof issues.$inferInsert>,
) {
  const [team] = await db
    .update(teams)
    .set({ issueCounter: sql`${teams.issueCounter} + 1` })
    .where(eq(teams.id, input.teamId))
    .returning()
  const [status] = await db
    .select()
    .from(workflowStatuses)
    .where(and(eq(workflowStatuses.teamId, team!.id), eq(workflowStatuses.position, 0)))
  const [issue] = await db
    .insert(issues)
    .values({
      workspaceId: team!.workspaceId,
      number: team!.issueCounter,
      title: `Issue ${next()}`,
      statusId: status!.id,
      ...input,
    })
    .returning()
  return issue!
}
