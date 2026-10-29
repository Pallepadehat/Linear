import { uploads, users, workspaceMembers, type DbOrTx, type UploadVariants } from '@linear/db'
import { and, eq, lt, sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { DomainError } from '../errors'

export type Upload = typeof uploads.$inferSelect
export type UploadKind = Upload['kind']

export type CreateUploadInput = {
  kind: UploadKind
  uploadedById: string
  workspaceId: string | null
  contentType: string
  size: number
  /** Builds the object key from the new upload's ID (see packages/storage key helpers). */
  objectKey: (uploadId: string) => string
}

/** Records a pending upload. Type/size are validated by the caller (contract schema). */
export async function createUpload(db: DbOrTx, input: CreateUploadInput) {
  const id = uuidv7()
  const [upload] = await db
    .insert(uploads)
    .values({
      id,
      kind: input.kind,
      uploadedById: input.uploadedById,
      workspaceId: input.workspaceId,
      contentType: input.contentType,
      size: input.size,
      objectKey: input.objectKey(id),
    })
    .returning()
  if (!upload) throw new Error('upload insert returned no row')
  return upload
}

/** The uploader's own upload; NOT_FOUND for anyone else so IDs can't be probed. */
export async function getOwnUpload(db: DbOrTx, uploadId: string, userId: string) {
  const [upload] = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, uploadId), eq(uploads.uploadedById, userId)))
  if (!upload || upload.status === 'deleted') throw new DomainError('NOT_FOUND', 'Upload not found')
  return upload
}

export async function markUploadReady(db: DbOrTx, uploadId: string) {
  const [upload] = await db
    .update(uploads)
    .set({ status: 'ready' })
    .where(and(eq(uploads.id, uploadId), eq(uploads.status, 'pending')))
    .returning()
  return upload ?? null
}

export async function markUploadDeleted(db: DbOrTx, uploadId: string) {
  const [upload] = await db
    .update(uploads)
    .set({ status: 'deleted' })
    .where(eq(uploads.id, uploadId))
    .returning()
  return upload ?? null
}

export async function setUploadVariants(db: DbOrTx, uploadId: string, variants: UploadVariants) {
  await db.update(uploads).set({ variants }).where(eq(uploads.id, uploadId))
}

export async function getUpload(db: DbOrTx, uploadId: string) {
  const [upload] = await db.select().from(uploads).where(eq(uploads.id, uploadId))
  return upload ?? null
}

/**
 * Points the user's avatar at a confirmed upload, or clears it with `null`. Returns
 * the replaced upload ID (now marked deleted) so the caller can remove its objects.
 */
export async function setUserAvatar(db: DbOrTx, userId: string, uploadId: string | null) {
  return db.transaction(async (tx) => {
    if (uploadId) {
      const upload = await getOwnUpload(tx, uploadId, userId)
      if (upload.kind !== 'avatar' || upload.status !== 'ready') {
        throw new DomainError('BAD_REQUEST', 'Upload is not a confirmed avatar')
      }
    }
    const [previous] = await tx
      .select({ avatarUploadId: users.avatarUploadId })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
    await tx.update(users).set({ avatarUploadId: uploadId }).where(eq(users.id, userId))
    const replaced = previous?.avatarUploadId ?? null
    if (!replaced || replaced === uploadId) return { replacedUploadId: null }
    await markUploadDeleted(tx, replaced)
    return { replacedUploadId: replaced }
  })
}

/**
 * Read access: workspace-owned files need membership of that workspace; avatars are
 * visible to the owner and to anyone who shares a workspace with them.
 */
export async function canReadUpload(db: DbOrTx, upload: Upload, userId: string) {
  if (upload.status !== 'ready') return false
  if (upload.workspaceId) {
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, upload.workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
    return Boolean(member)
  }
  if (upload.uploadedById === userId) return true
  const [shared] = await db.execute<{ shared: boolean }>(sql`
    select exists (
      select 1 from ${workspaceMembers} a
      join ${workspaceMembers} b on a.workspace_id = b.workspace_id
      where a.user_id = ${userId} and b.user_id = ${upload.uploadedById}
    ) as shared
  `)
  return Boolean(shared?.shared)
}

/** Pending uploads older than the cutoff (never confirmed); for the maintenance job. */
export async function listStalePendingUploads(db: DbOrTx, olderThan: Date) {
  return db
    .select()
    .from(uploads)
    .where(and(eq(uploads.status, 'pending'), lt(uploads.createdAt, olderThan)))
}
