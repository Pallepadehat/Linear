import type { CreatePresignedUploadInput } from '@linear/contract'
import { UPLOAD_RULES } from '@linear/contract'
import { ref } from 'vue'
import { client } from '@/lib/orpc'

/**
 * presign → PUT directly to object storage → confirm. File bytes never pass
 * through the API. Type and size are checked here for fast feedback; the API
 * enforces the same rules.
 */
export function useUpload() {
  const isUploading = ref(false)

  async function upload(
    file: File,
    target: Pick<CreatePresignedUploadInput, 'kind' | 'workspaceSlug'>,
  ) {
    const rule = UPLOAD_RULES[target.kind]
    if (!(rule.contentTypes as readonly string[]).includes(file.type)) {
      throw new Error(
        `Use a ${rule.contentTypes.map((t) => t.split('/')[1]?.toUpperCase()).join(', ')} file`,
      )
    }
    if (file.size > rule.maxBytes) {
      throw new Error(`File is larger than ${rule.maxBytes / 1024 / 1024} MB`)
    }

    isUploading.value = true
    try {
      const presigned = await client.uploads.createPresignedUpload({
        ...target,
        contentType: file.type,
        size: file.size,
      })
      const res = await fetch(presigned.url, {
        method: presigned.method,
        headers: presigned.headers,
        body: file,
      })
      if (!res.ok) throw new Error('Upload failed')
      await client.uploads.confirm({ uploadId: presigned.uploadId })
      return presigned.uploadId
    } finally {
      isUploading.value = false
    }
  }

  return { upload, isUploading }
}
