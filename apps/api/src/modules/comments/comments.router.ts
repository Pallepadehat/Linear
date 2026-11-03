import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
  type CommentRecord,
} from '@linear/core'
import type { DbOrTx } from '@linear/db'
import type { Storage } from '@linear/storage'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { imageUrl } from '../../lib/upload-urls'
import { toCommentDto } from './comments.dto'

const inWorkspace = requireWorkspace()

type Deps = { db: DbOrTx; storage: Storage }

/** Resolves each distinct author's avatar once per page, not once per comment. */
async function toCommentDtos(deps: Deps, records: CommentRecord[]) {
  const uploadIds = [...new Set(records.map((r) => r.authorAvatarUploadId))]
  const urls = new Map(
    await Promise.all(
      uploadIds.map(async (id) => [id, await imageUrl(deps.db, deps.storage, id)] as const),
    ),
  )
  return records.map((r) => toCommentDto(r, urls.get(r.authorAvatarUploadId) ?? null))
}

async function toCommentDtoWithAvatar(deps: Deps, record: CommentRecord) {
  return toCommentDto(record, await imageUrl(deps.db, deps.storage, record.authorAvatarUploadId))
}

export const commentsRouter = {
  list: authed.comments.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const page = await listComments(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        cursor: input.cursor,
        limit: input.limit,
      })
      return { items: await toCommentDtos(context, page.items), nextCursor: page.nextCursor }
    }),

  create: authed.comments.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const comment = await createComment(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        authorId: context.user.id,
        body: input.body,
      })
      return toCommentDtoWithAvatar(context, comment)
    }),

  update: authed.comments.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const comment = await updateComment(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        userId: context.user.id,
        body: input.body,
      })
      return toCommentDtoWithAvatar(context, comment)
    }),

  delete: authed.comments.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      deleteComment(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        userId: context.user.id,
        canDeleteOthers: context.role === 'owner',
      }),
    ),
}
