import { releaseOrphanedAttachments } from '@linear/core'
import type { JobDeps } from '../../deps'
import { deleteObjects } from './delete-objects'

export const ORPHANED_ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Deletes attachments no issue has referenced for 24 h: files uploaded in a dialog
 * that was then closed, or removed from a description (the grace period lets an
 * undo bring the reference back).
 */
export async function cleanupAttachments(deps: JobDeps, now = new Date()) {
  const released = await releaseOrphanedAttachments(
    deps.db,
    new Date(now.getTime() - ORPHANED_ATTACHMENT_TTL_MS),
  )
  for (const uploadId of released) await deleteObjects(deps, uploadId)
  deps.logger.info({ count: released.length }, 'cleanup-attachments: done')
}
