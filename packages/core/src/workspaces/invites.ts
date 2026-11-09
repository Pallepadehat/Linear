import { workspaceMembers, workspaces, type DbOrTx } from '@linear/db'
import { eq } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'
import { findMembershipById } from './workspaces.service'

// 32 symbols without the look-alikes 0/O and 1/I, so codes survive being read aloud or retyped.
// 256 is a multiple of 32, so `byte % 32` is unbiased. 10 symbols = 50 bits: not guessable.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const INVITE_CODE_LENGTH = 10

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Case, spaces and dashes don't matter, so `abcde-fghjk` matches `ABCDEFGHJK`. */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function getInviteCode(db: DbOrTx, workspaceId: string) {
  const [row] = await db
    .select({ code: workspaces.inviteCode })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
  return row?.code ?? null
}

/** Replaces the code with a fresh one; the old code stops working immediately. */
export async function resetInviteCode(db: DbOrTx, workspaceId: string): Promise<string> {
  // A collision is astronomically unlikely, but the unique constraint makes a retry cheap.
  for (let attempt = 0; ; attempt++) {
    const code = generateInviteCode()
    try {
      await db
        .update(workspaces)
        .set({ inviteCode: code, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
      return code
    } catch (error) {
      if (attempt < 2 && isUniqueViolation(error, 'workspaces_invite_code_unique')) continue
      throw error
    }
  }
}

export async function disableInviteCode(db: DbOrTx, workspaceId: string) {
  await db
    .update(workspaces)
    .set({ inviteCode: null, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
}

/**
 * Adds the user to the workspace with this invite code as a `member`. Joining a workspace
 * you're already in is a no-op that keeps your role. Unknown or turned-off codes are NOT_FOUND.
 */
export async function joinWorkspaceByCode(db: DbOrTx, userId: string, rawCode: string) {
  const code = normalizeInviteCode(rawCode)
  const [workspace] =
    code.length === INVITE_CODE_LENGTH
      ? await db.select().from(workspaces).where(eq(workspaces.inviteCode, code))
      : []
  if (!workspace) throw new DomainError('NOT_FOUND', 'That invite code is not valid')

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId, role: 'member' })
    .onConflictDoNothing({ target: [workspaceMembers.workspaceId, workspaceMembers.userId] })

  const membership = await findMembershipById(db, workspace.id, userId)
  if (!membership) throw new Error('membership missing right after join')
  return membership
}
