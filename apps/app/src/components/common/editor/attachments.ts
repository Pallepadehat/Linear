import { UPLOAD_RULES } from '@linear/contract'

// Descriptions store `attachment:<uploadId>` instead of a URL: presigned URLs expire
// (and every read needs a membership check), so they're resolved when shown.
const SCHEME = 'attachment:'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ATTACHMENT_TYPES: readonly string[] = UPLOAD_RULES.attachment.contentTypes
export const ATTACHMENT_MAX_BYTES = UPLOAD_RULES.attachment.maxBytes

export const attachmentHref = (uploadId: string) => `${SCHEME}${uploadId}`

/** The upload id of an `attachment:` reference, or null for anything else. */
export function parseAttachmentId(href: string | null | undefined): string | null {
  if (!href?.startsWith(SCHEME)) return null
  const id = href.slice(SCHEME.length)
  return UUID.test(id) ? id : null
}

export const isImageType = (contentType: string) => contentType.startsWith('image/')

/** Checked before uploading for fast feedback; the API enforces the same rules. */
export function attachmentError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ATTACHMENT_TYPES.includes(file.type)) return 'Use an image, PDF, text or zip file'
  if (file.size > ATTACHMENT_MAX_BYTES)
    return `Files can be up to ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB`
  return null
}
