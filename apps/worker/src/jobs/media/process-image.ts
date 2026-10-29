import { getUpload, setUploadVariants } from '@linear/core'
import type { UploadVariants } from '@linear/db'
import { variantKey } from '@linear/storage'
import sharp from 'sharp'
import type { JobDeps } from '../../deps'

const SIZES = { avatar: [256, 64], workspace_icon: [256, 64], project_icon: [256, 64] } as const

/**
 * Re-encodes the original without metadata (EXIF, GPS) and writes square WebP
 * variants. Idempotent: every run writes the same keys.
 */
export async function processImage({ db, storage, logger }: JobDeps, uploadId: string) {
  const upload = await getUpload(db, uploadId)
  if (!upload || upload.status !== 'ready' || upload.kind === 'attachment') {
    logger.info({ uploadId, status: upload?.status }, 'process-image: nothing to do')
    return
  }

  const input = await storage.get(upload.objectKey)
  // `rotate()` applies EXIF orientation before the metadata is dropped.
  const image = sharp(input, { failOn: 'error' }).rotate()

  const original = await image.clone().toBuffer()
  await storage.put(upload.objectKey, original, upload.contentType)

  const variants: UploadVariants = { original: upload.objectKey }
  for (const size of SIZES[upload.kind]) {
    const key = variantKey(upload.objectKey, String(size), 'webp')
    const body = await image
      .clone()
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()
    await storage.put(key, body, 'image/webp')
    variants[String(size) as '256' | '64'] = key
  }

  await setUploadVariants(db, upload.id, variants)
  logger.info({ uploadId }, 'process-image: done')
}
