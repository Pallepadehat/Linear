import { findMembershipById, findMembershipBySlug, type WorkspaceRole } from '@linear/core'
import type { DbOrTx } from '@linear/db'
import { ORPCError, os } from '@orpc/server'
import type { InitialContext, Session } from '../context'

type AuthedContext = InitialContext & { user: Session['user'] }

/**
 * Resolves a workspace the user belongs to. Non-members get NOT_FOUND (not
 * FORBIDDEN) so workspace slugs can't be probed; role checks happen afterwards.
 */
export async function resolveWorkspace(
  db: DbOrTx,
  slug: string,
  userId: string,
  role?: WorkspaceRole,
) {
  return checkMembership(await findMembershipBySlug(db, slug, userId), role)
}

/** `resolveWorkspace` for flows that carry the workspace id instead of the slug. */
export async function resolveWorkspaceById(
  db: DbOrTx,
  workspaceId: string,
  userId: string,
  role?: WorkspaceRole,
) {
  return checkMembership(await findMembershipById(db, workspaceId, userId), role)
}

function checkMembership<T extends { role: WorkspaceRole }>(
  membership: T | null,
  role: WorkspaceRole | undefined,
) {
  if (!membership) throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' })
  if (role === 'owner' && membership.role !== 'owner') {
    throw new ORPCError('FORBIDDEN', { message: 'Only workspace owners can do this' })
  }
  return membership
}

/**
 * Usage: `.use(requireWorkspace(), (input) => input.workspaceSlug)`;
 * pass `'owner'` for owner-only procedures.
 */
export function requireWorkspace(role?: WorkspaceRole) {
  return os
    .$context<AuthedContext>()
    .middleware(async ({ context, next }, workspaceSlug: string) => {
      const { workspace, role: memberRole } = await resolveWorkspace(
        context.db,
        workspaceSlug,
        context.user.id,
        role,
      )
      return next({ context: { workspace, role: memberRole } })
    })
}
