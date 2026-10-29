import { getUpload } from '@linear/core'
import type { JobDeps } from '../../deps'

/** Removes an upload's objects once its row is marked deleted. Idempotent. */
export async function deleteObjects({ db, storage, logger }: JobDeps, uploadId: string) {
  const upload = await getUpload(db, uploadId)
  if (!upload || upload.status !== 'deleted') {
    logger.info({ uploadId, status: upload?.status }, 'delete-objects: skipped, upload not deleted')
    return
  }
  const keys = new Set([upload.objectKey, ...Object.values(upload.variants)])
  await storage.delete([...keys])
  logger.info({ uploadId, objects: keys.size }, 'delete-objects: done')
}
