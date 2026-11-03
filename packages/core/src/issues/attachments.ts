import { issueAttachments, uploads, type DbOrTx } from '@linear/db'
import { and, eq, inArray, lt, notExists, notInArray, sql } from 'drizzle-orm'
import { DomainError } from '../errors'

// `[name](attachment:<id>)` / `![name](attachment:<id> "title")`, optionally `<…>`-wrapped.
// Only link destinations count, so prose that merely mentions the scheme is ignored.
const ATTACHMENT_REF =
  /\]\(\s*<?attachment:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi

/** Unique upload ids referenced by `attachment:` links in a markdown description. */
export function parseAttachmentIds(markdown: string | null | undefined): string[] {
  if (!markdown) return []
  const ids = new Set<string>()
  for (const match of markdown.matchAll(ATTACHMENT_REF)) ids.add(match[1]!.toLowerCase())
  return [...ids]
}

/**
 * Makes the issue's links match the attachments its description references. Each
 * reference must be a ready `attachment` upload in the workspace (else BAD_REQUEST).
 *
 * Every referenced upload has its `updatedAt` bumped, which also row-locks it: a
 * concurrent orphan sweep then re-checks the fresh timestamp and skips it. Links
 * that are dropped bump it too, so the sweep's 24 h grace period (which lets an
 * undo restore the reference) starts when the reference was removed.
 */
export async function syncIssueAttachments(
  tx: DbOrTx,
  workspaceId: string,
  issueId: string,
  description: string | null,
) {
  const ids = parseAttachmentIds(description)
  const touched = new Date()
  if (ids.length > 0) {
    const found = await tx
      .update(uploads)
      .set({ updatedAt: touched })
      .where(
        and(
          inArray(uploads.id, ids),
          eq(uploads.workspaceId, workspaceId),
          eq(uploads.kind, 'attachment'),
          eq(uploads.status, 'ready'),
        ),
      )
      .returning({ id: uploads.id })
    if (found.length !== ids.length) {
      throw new DomainError('BAD_REQUEST', 'Attachment not found')
    }
  }

  const removed = await tx
    .delete(issueAttachments)
    .where(
      and(
        eq(issueAttachments.workspaceId, workspaceId),
        eq(issueAttachments.issueId, issueId),
        ids.length > 0 ? notInArray(issueAttachments.uploadId, ids) : undefined,
      ),
    )
    .returning({ uploadId: issueAttachments.uploadId })
  if (removed.length > 0) {
    await tx
      .update(uploads)
      .set({ updatedAt: touched })
      .where(
        inArray(
          uploads.id,
          removed.map((row) => row.uploadId),
        ),
      )
  }
  if (ids.length > 0) {
    await tx
      .insert(issueAttachments)
      .values(ids.map((uploadId) => ({ workspaceId, issueId, uploadId })))
      .onConflictDoNothing({ target: [issueAttachments.issueId, issueAttachments.uploadId] })
  }
}

/** The upload ids an issue links to; read before deleting it (the links cascade). */
export async function listIssueAttachmentIds(tx: DbOrTx, workspaceId: string, issueId: string) {
  const rows = await tx
    .select({ uploadId: issueAttachments.uploadId })
    .from(issueAttachments)
    .where(
      and(eq(issueAttachments.workspaceId, workspaceId), eq(issueAttachments.issueId, issueId)),
    )
  return rows.map((row) => row.uploadId)
}

const unlinked = notExists(
  sql`(select 1 from ${issueAttachments} where ${issueAttachments.uploadId} = ${uploads.id})`,
)

/**
 * Marks the given attachments deleted unless another issue still links them, and
 * returns the ids whose objects the caller must remove (`delete-objects`).
 */
export async function releaseAttachments(tx: DbOrTx, workspaceId: string, uploadIds: string[]) {
  if (uploadIds.length === 0) return []
  const scope = and(
    inArray(uploads.id, uploadIds),
    eq(uploads.workspaceId, workspaceId),
    eq(uploads.kind, 'attachment'),
    eq(uploads.status, 'ready'),
  )
  // Lock first so the next statement's fresh snapshot sees links committed by a
  // concurrent sync that held these rows.
  await tx.select({ id: uploads.id }).from(uploads).where(scope).for('update')
  const released = await tx
    .update(uploads)
    .set({ status: 'deleted' })
    .where(and(scope, unlinked))
    .returning({ id: uploads.id })
  return released.map((row) => row.id)
}

/**
 * Marks `ready` attachments that no issue links to, untouched since the cutoff
 * (abandoned drafts, removed references), as deleted; for the maintenance job.
 */
export async function releaseOrphanedAttachments(db: DbOrTx, olderThan: Date) {
  const released = await db
    .update(uploads)
    .set({ status: 'deleted' })
    .where(
      and(
        eq(uploads.kind, 'attachment'),
        eq(uploads.status, 'ready'),
        lt(uploads.updatedAt, olderThan),
        unlinked,
      ),
    )
    .returning({ id: uploads.id })
  return released.map((row) => row.id)
}
