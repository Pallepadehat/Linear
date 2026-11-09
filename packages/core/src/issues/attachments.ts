import { commentAttachments, comments, issueAttachments, uploads, type DbOrTx } from '@linear/db'
import { and, eq, inArray, lt, notExists, notInArray, or, sql } from 'drizzle-orm'
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
 * Checks every id is a ready `attachment` upload in the workspace (else BAD_REQUEST) and
 * bumps its `updatedAt`, which also row-locks it: a concurrent orphan sweep then
 * re-checks the fresh timestamp and skips it.
 */
async function claimAttachments(tx: DbOrTx, workspaceId: string, ids: string[], touched: Date) {
  if (ids.length === 0) return
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

/**
 * Dropped links bump their uploads too, so the sweep's 24 h grace period (which lets
 * an undo restore the reference) starts when the reference was removed.
 */
async function touchUploads(tx: DbOrTx, uploadIds: string[], touched: Date) {
  if (uploadIds.length === 0) return
  await tx.update(uploads).set({ updatedAt: touched }).where(inArray(uploads.id, uploadIds))
}

/**
 * Makes the issue's links match the attachments its description references. Each
 * reference must be a ready `attachment` upload in the workspace (else BAD_REQUEST).
 */
export async function syncIssueAttachments(
  tx: DbOrTx,
  workspaceId: string,
  issueId: string,
  description: string | null,
) {
  const ids = parseAttachmentIds(description)
  const touched = new Date()
  await claimAttachments(tx, workspaceId, ids, touched)
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
  await touchUploads(
    tx,
    removed.map((row) => row.uploadId),
    touched,
  )
  if (ids.length > 0) {
    await tx
      .insert(issueAttachments)
      .values(ids.map((uploadId) => ({ workspaceId, issueId, uploadId })))
      .onConflictDoNothing({ target: [issueAttachments.issueId, issueAttachments.uploadId] })
  }
}

/** Same as `syncIssueAttachments`, for a comment body. */
export async function syncCommentAttachments(
  tx: DbOrTx,
  workspaceId: string,
  commentId: string,
  body: string,
) {
  const ids = parseAttachmentIds(body)
  const touched = new Date()
  await claimAttachments(tx, workspaceId, ids, touched)
  const removed = await tx
    .delete(commentAttachments)
    .where(
      and(
        eq(commentAttachments.workspaceId, workspaceId),
        eq(commentAttachments.commentId, commentId),
        ids.length > 0 ? notInArray(commentAttachments.uploadId, ids) : undefined,
      ),
    )
    .returning({ uploadId: commentAttachments.uploadId })
  await touchUploads(
    tx,
    removed.map((row) => row.uploadId),
    touched,
  )
  if (ids.length > 0) {
    await tx
      .insert(commentAttachments)
      .values(ids.map((uploadId) => ({ workspaceId, commentId, uploadId })))
      .onConflictDoNothing({
        target: [commentAttachments.commentId, commentAttachments.uploadId],
      })
  }
}

/**
 * The upload ids a comment and its replies link to; read before deleting it (the
 * replies and links cascade).
 */
export async function listCommentAttachmentIds(tx: DbOrTx, workspaceId: string, commentId: string) {
  const rows = await tx
    .selectDistinct({ uploadId: commentAttachments.uploadId })
    .from(commentAttachments)
    .innerJoin(comments, eq(comments.id, commentAttachments.commentId))
    .where(
      and(
        eq(commentAttachments.workspaceId, workspaceId),
        or(eq(comments.id, commentId), eq(comments.parentId, commentId)),
      ),
    )
  return rows.map((row) => row.uploadId)
}

/**
 * The upload ids an issue links to, from its description or any of its comments; read
 * before deleting it (the links cascade).
 */
export async function listIssueAttachmentIds(tx: DbOrTx, workspaceId: string, issueId: string) {
  const fromIssue = await tx
    .select({ uploadId: issueAttachments.uploadId })
    .from(issueAttachments)
    .where(
      and(eq(issueAttachments.workspaceId, workspaceId), eq(issueAttachments.issueId, issueId)),
    )
  const fromComments = await tx
    .select({ uploadId: commentAttachments.uploadId })
    .from(commentAttachments)
    .innerJoin(comments, eq(comments.id, commentAttachments.commentId))
    .where(and(eq(commentAttachments.workspaceId, workspaceId), eq(comments.issueId, issueId)))
  return [...new Set([...fromIssue, ...fromComments].map((row) => row.uploadId))]
}

// Neither an issue description nor a comment links the upload.
const unlinked = and(
  notExists(
    sql`(select 1 from ${issueAttachments} where ${issueAttachments.uploadId} = ${uploads.id})`,
  ),
  notExists(
    sql`(select 1 from ${commentAttachments} where ${commentAttachments.uploadId} = ${uploads.id})`,
  ),
)

/**
 * Marks the given attachments deleted unless an issue or comment still links them, and
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
 * Marks `ready` attachments that no issue or comment links to, untouched since the cutoff
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
