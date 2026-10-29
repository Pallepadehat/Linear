import { getUser, listWorkspacesForUser, setUserAvatar, updateUser } from '@linear/core'
import { enqueue } from '@linear/queue'
import { authed } from '../../orpc/base'
import { imageUrl } from '../../lib/upload-urls'
import { toWorkspaceDto } from '../workspaces/workspaces.dto'

export const meRouter = {
  get: authed.me.get.handler(async ({ context }) => {
    const user = await getUser(context.db, context.user.id)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: await imageUrl(context.db, context.storage, user.avatarUploadId),
    }
  }),

  update: authed.me.update.handler(async ({ context, input }) => {
    if (input.avatarUploadId !== undefined) {
      const { replacedUploadId } = await setUserAvatar(
        context.db,
        context.user.id,
        input.avatarUploadId,
      )
      if (replacedUploadId) {
        await enqueue(context.queues, 'maintenance', 'delete-objects', {
          uploadId: replacedUploadId,
        })
      }
    }
    const user = await updateUser(context.db, context.user.id, { name: input.name })
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: await imageUrl(context.db, context.storage, user.avatarUploadId),
    }
  }),

  listWorkspaces: authed.me.listWorkspaces.handler(async ({ context }) => {
    const rows = await listWorkspacesForUser(context.db, context.user.id)
    return rows.map((row) => toWorkspaceDto(row.workspace, row.role))
  }),
}
