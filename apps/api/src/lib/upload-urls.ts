import { getUpload } from '@linear/core'
import type { DbOrTx } from '@linear/db'
import type { Storage } from '@linear/storage'

/**
 * Presigned URL for an image upload, preferring the processed (metadata-stripped)
 * 256px variant. Callers must already have checked read access.
 */
export async function imageUrl(db: DbOrTx, storage: Storage, uploadId: string | null) {
  if (!uploadId) return null
  const upload = await getUpload(db, uploadId)
  if (!upload || upload.status !== 'ready') return null
  return storage.presignGet(upload.variants['256'] ?? upload.objectKey)
}
