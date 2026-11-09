import { UPLOAD_RULES } from '@linear/contract'
import {
  canReadUpload,
  createUpload,
  getOwnUpload,
  getUpload,
  markUploadDeleted,
  markUploadReady,
} from '@linear/core'
import { enqueue } from '@linear/queue'
import {
  PRESIGNED_GET_TTL_SECONDS,
  PRESIGNED_PUT_TTL_SECONDS,
  extensionFor,
  objectKey,
} from '@linear/storage'
import { ORPCError } from '@orpc/server'
import { authed } from '../../orpc/base'
import { resolveWorkspace } from '../../orpc/middleware/require-workspace'

export const uploadsRouter = {
  // Type and size are validated by the contract schema before we get here.
  createPresignedUpload: authed.uploads.createPresignedUpload.handler(
    async ({ context, input }) => {
      let workspaceId: string | null = null
      if (input.workspaceSlug) {
        const role = input.kind === 'workspace_icon' ? 'owner' : undefined
        const { workspace } = await resolveWorkspace(
          context.db,
          input.workspaceSlug,
          context.user.id,
          role,
        )
        workspaceId = workspace.id
      }
      const owner = workspaceId
        ? ({ type: 'workspace', workspaceId } as const)
        : ({ type: 'user', userId: context.user.id } as const)

      const upload = await createUpload(context.db, {
        kind: input.kind,
        uploadedById: context.user.id,
        workspaceId,
        contentType: input.contentType,
        size: input.size,
        objectKey: (id) =>
          objectKey(owner, input.kind, id, 'original', extensionFor(input.contentType)),
      })
      const url = await context.storage.presignPut(
        upload.objectKey,
        upload.contentType,
        upload.size,
      )
      return {
        uploadId: upload.id,
        url,
        method: 'PUT' as const,
        headers: { 'Content-Type': upload.contentType },
        expiresAt: new Date(Date.now() + PRESIGNED_PUT_TTL_SECONDS * 1000),
      }
    },
  ),

  confirm: authed.uploads.confirm.handler(async ({ context, input }) => {
    const upload = await getOwnUpload(context.db, input.uploadId, context.user.id)
    const kind = upload.kind
    if (upload.status === 'ready') return { id: upload.id, kind, status: upload.status }

    const head = await context.storage.head(upload.objectKey)
    if (!head) throw new ORPCError('BAD_REQUEST', { message: 'File was not uploaded' })
    // The signed PUT pins the size, but verify anyway: storage is the source of truth.
    if (head.size !== upload.size || head.size > UPLOAD_RULES[kind].maxBytes) {
      await markUploadDeleted(context.db, upload.id)
      await enqueue(context.queues, 'maintenance', 'delete-objects', { uploadId: upload.id })
      throw new ORPCError('BAD_REQUEST', { message: 'Uploaded file does not match the request' })
    }

    const ready = await markUploadReady(context.db, upload.id)
    // Attachments are served as uploaded; only icons and avatars get resized variants.
    if (ready && kind !== 'attachment') {
      await enqueue(
        context.queues,
        'media',
        'process-image',
        { uploadId: upload.id },
        { jobId: `process-image-${upload.id}` },
      )
    }
    return { id: upload.id, kind, status: 'ready' as const }
  }),

  getUrl: authed.uploads.getUrl.handler(async ({ context, input }) => {
    const upload = await getUpload(context.db, input.uploadId)
    if (!upload || !(await canReadUpload(context.db, upload, context.user.id))) {
      throw new ORPCError('NOT_FOUND', { message: 'Upload not found' })
    }
    return {
      url: await context.storage.presignGet(upload.variants['256'] ?? upload.objectKey),
      expiresAt: new Date(Date.now() + PRESIGNED_GET_TTL_SECONDS * 1000),
    }
  }),
}
