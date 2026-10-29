export type ObjectOwner =
  { type: 'user'; userId: string } | { type: 'workspace'; workspaceId: string }

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/zip': 'zip',
}

export function extensionFor(contentType: string): string {
  return EXTENSIONS[contentType] ?? 'bin'
}

/**
 * `users/{userId}/avatar/{uploadId}/{variant}.{ext}` or
 * `workspaces/{workspaceId}/{kind}/{uploadId}/{variant}.{ext}` (PRD §8.8).
 */
export function objectKey(
  owner: ObjectOwner,
  kind: string,
  uploadId: string,
  variant: string,
  ext: string,
) {
  const prefix = owner.type === 'user' ? `users/${owner.userId}` : `workspaces/${owner.workspaceId}`
  return `${prefix}/${kind}/${uploadId}/${variant}.${ext}`
}

/** Sibling key for a processed variant of an original object. */
export function variantKey(originalKey: string, variant: string, ext: string) {
  return originalKey.replace(/\/[^/]+$/, `/${variant}.${ext}`)
}
