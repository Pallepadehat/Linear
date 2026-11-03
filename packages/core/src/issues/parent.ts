import { issues, teams, type DbOrTx } from '@linear/db'
import { and, eq, sql } from 'drizzle-orm'
import { DomainError } from '../errors'

/** Parent chains are short in practice; this only guards against corrupt data looping forever. */
const MAX_DEPTH = 10_000

/**
 * Throws `BAD_REQUEST` when making `parentId` the parent of `issueId` would make
 * the issue its own parent or ancestor. Walks up from the proposed parent;
 * `parentOf` returns an issue's current parent id (null at the root).
 */
export async function assertNoParentCycle(
  issueId: string,
  parentId: string,
  parentOf: (id: string) => Promise<string | null>,
) {
  if (parentId === issueId) throw new DomainError('BAD_REQUEST', "An issue can't be its own parent")
  let current: string | null = parentId
  for (let depth = 0; current !== null && depth < MAX_DEPTH; depth++) {
    current = await parentOf(current)
    if (current === issueId) {
      throw new DomainError('BAD_REQUEST', "An issue can't be a sub-issue of its own sub-issue")
    }
  }
}

export type ParentRef = { id: string; identifier: string }

/**
 * Validates a new parent inside the caller's transaction and returns it with its
 * identifier. The parent must be in the same workspace (teams may differ), else
 * `NOT_FOUND`. `issueId` is null for an issue being created, which can't be part
 * of a cycle yet.
 */
export async function resolveParent(
  tx: DbOrTx,
  workspaceId: string,
  issueId: string | null,
  parentId: string,
): Promise<ParentRef> {
  // Serializes parent changes per workspace so two concurrent edits (A under B,
  // B under A) can't each pass the cycle check and commit a loop together.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`issue-parent:${workspaceId}`}, 0))`,
  )
  const parent = await findIssueRef(tx, workspaceId, parentId)
  if (!parent) throw new DomainError('NOT_FOUND', 'Parent issue not found')
  if (issueId) {
    await assertNoParentCycle(issueId, parentId, async (id) => {
      const [row] = await tx
        .select({ parentId: issues.parentId })
        .from(issues)
        .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
      return row?.parentId ?? null
    })
  }
  return parent
}

/** An issue's id and `TIP-12` identifier, scoped to the workspace. */
export async function findIssueRef(
  db: DbOrTx,
  workspaceId: string,
  id: string,
): Promise<ParentRef | undefined> {
  const [row] = await db
    .select({ id: issues.id, number: issues.number, teamKey: teams.key })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
  return row ? { id: row.id, identifier: `${row.teamKey}-${row.number}` } : undefined
}
