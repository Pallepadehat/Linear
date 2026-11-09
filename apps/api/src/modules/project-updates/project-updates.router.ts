import {
  createProjectUpdate,
  deleteProjectUpdate,
  listProjectUpdates,
  updateProjectUpdate,
  type ProjectUpdateRecord,
} from '@linear/core'
import type { DbOrTx } from '@linear/db'
import type { Storage } from '@linear/storage'
import { imageUrl } from '../../lib/upload-urls'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'
import { toProjectUpdateDto } from './project-updates.dto'

const inWorkspace = requireWorkspace()

type Deps = { db: DbOrTx; storage: Storage }

async function withAvatar(deps: Deps, record: ProjectUpdateRecord) {
  return toProjectUpdateDto(
    record,
    await imageUrl(deps.db, deps.storage, record.authorAvatarUploadId),
  )
}

// Every write changes the project's health or feed, so it publishes `project.updated`.
export const projectUpdatesRouter = {
  list: authed.projectUpdates.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const page = await listProjectUpdates(context.db, {
        workspaceId: context.workspace.id,
        projectId: input.projectId,
        cursor: input.cursor,
        limit: input.limit,
      })
      // Each distinct author's avatar is resolved once per page, not once per update.
      const avatars = new Map(
        await Promise.all(
          [...new Set(page.items.map((item) => item.authorAvatarUploadId))].map(
            async (id) => [id, await imageUrl(context.db, context.storage, id)] as const,
          ),
        ),
      )
      return {
        items: page.items.map((item) =>
          toProjectUpdateDto(item, avatars.get(item.authorAvatarUploadId) ?? null),
        ),
        nextCursor: page.nextCursor,
      }
    }),

  create: authed.projectUpdates.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const update = await createProjectUpdate(context.db, {
        workspaceId: context.workspace.id,
        projectId: input.projectId,
        authorId: context.user.id,
        health: input.health,
        body: input.body,
      })
      await publishChange(context, { type: 'project.updated', projectId: update.projectId })
      return withAvatar(context, update)
    }),

  update: authed.projectUpdates.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const update = await updateProjectUpdate(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        userId: context.user.id,
        health: input.health,
        body: input.body,
      })
      await publishChange(context, { type: 'project.updated', projectId: update.projectId })
      return withAvatar(context, update)
    }),

  delete: authed.projectUpdates.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { id, projectId } = await deleteProjectUpdate(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        userId: context.user.id,
        canDeleteOthers: context.role === 'owner',
      })
      await publishChange(context, { type: 'project.updated', projectId })
      return { id }
    }),
}
