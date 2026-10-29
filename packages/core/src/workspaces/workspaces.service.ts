import { users, workspaceMembers, workspaces, type Db, type DbOrTx } from '@linear/db'
import { and, asc, eq } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'
import { RESERVED_WORKSPACE_SLUGS, WORKSPACE_SLUG_PATTERN } from '../identifiers'
import { createTeam } from '../teams'

export type WorkspaceRole = (typeof workspaceMembers.$inferSelect)['role']

export type CreateWorkspaceInput = {
  userId: string
  name: string
  slug: string
  /** Optional first team, created in the same transaction. */
  team?: { name: string; key: string }
}

export async function createWorkspace(db: Db, input: CreateWorkspaceInput) {
  const slug = input.slug.trim().toLowerCase()
  if (!WORKSPACE_SLUG_PATTERN.test(slug) || RESERVED_WORKSPACE_SLUGS.has(slug)) {
    throw new DomainError('BAD_REQUEST', 'Invalid workspace URL')
  }

  try {
    return await db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: input.name.trim(), slug, createdById: input.userId })
        .returning()
      if (!workspace) throw new Error('workspace insert returned no row')

      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: workspace.id, userId: input.userId, role: 'owner' })

      const team = input.team
        ? await createTeam(tx, {
            workspaceId: workspace.id,
            creatorId: input.userId,
            ...input.team,
          })
        : null
      return { workspace, team }
    })
  } catch (error) {
    if (isUniqueViolation(error, 'workspaces_slug_unique')) {
      throw new DomainError('CONFLICT', 'That workspace URL is taken')
    }
    throw error
  }
}

/** Membership lookup used for authorization; null when the user is not a member. */
export async function findMembershipBySlug(db: DbOrTx, slug: string, userId: string) {
  const [row] = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)),
    )
    .where(eq(workspaces.slug, slug.toLowerCase()))
  return row ?? null
}

export async function listWorkspacesForUser(db: DbOrTx, userId: string) {
  return db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.name))
}

export async function listMembers(db: DbOrTx, workspaceId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUploadId: users.avatarUploadId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.name))
}
