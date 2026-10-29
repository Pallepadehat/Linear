import { listStalePendingUploads, markUploadDeleted } from '@linear/core'
import type { JobDeps } from '../../deps'
import { deleteObjects } from './delete-objects'

export const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000

/** Deletes uploads that were presigned but never confirmed within 24 h. */
export async function cleanupPending(deps: JobDeps, now = new Date()) {
  const stale = await listStalePendingUploads(
    deps.db,
    new Date(now.getTime() - PENDING_UPLOAD_TTL_MS),
  )
  for (const upload of stale) {
    await markUploadDeleted(deps.db, upload.id)
    await deleteObjects(deps, upload.id)
  }
  deps.logger.info({ count: stale.length }, 'cleanup-pending: done')
}
