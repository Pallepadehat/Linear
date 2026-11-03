import { MAX_THREAD_REPLIES } from '@linear/contract'
import {
  createComment,
  deleteComment,
  listComments,
  reactToComment,
  resolveThread,
  unreactToComment,
  unresolveThread,
  updateComment,
  type CommentRecord,
} from '@linear/core'
import type { DbOrTx } from '@linear/db'
import type { Storage } from '@linear/storage'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { imageUrl } from '../../lib/upload-urls'
import { notify } from '../notifications/notify'
import { publishChange } from '../realtime/publish'
import { toCommentDto } from './comments.dto'

const inWorkspace = requireWorkspace()

type Deps = { db: DbOrTx; storage: Storage }

/** Resolves each distinct author's avatar once per page, not once per comment. */
async function avatarResolver(deps: Deps, records: CommentRecord[]) {
  const uploadIds = [...new Set(records.map((r) => r.authorAvatarUploadId))]
  const urls = new Map(
    await Promise.all(
      uploadIds.map(async (id) => [id, await imageUrl(deps.db, deps.storage, id)] as const),
    ),
  )
  return (r: CommentRecord) => toCommentDto(r, urls.get(r.authorAvatarUploadId) ?? null)
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
        viewerId: context.user.id,
        cursor: input.cursor,
        limit: input.limit,
        maxReplies: MAX_THREAD_REPLIES,
      })
      const toDto = await avatarResolver(
        context,
        page.items.flatMap((t) => [t, ...t.replies]),
      )
      return {
        items: page.items.map((thread) => ({
          ...toDto(thread),
          replies: thread.replies.map(toDto),
          replyCount: thread.replyCount,
        })),
        nextCursor: page.nextCursor,
      }
    }),

  create: authed.comments.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const comment = await createComment(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        authorId: context.user.id,
        parentId: input.parentId,
        body: input.body,
      })
      await publishChange(context, {
        type: 'comment.created',
        issueId: comment.issueId,
        commentId: comment.id,
      })
      await notify(context, [
        { issueId: comment.issueId, event: 'commented', commentId: comment.id },
      ])
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
      await publishChange(context, {
        type: 'comment.updated',
        issueId: comment.issueId,
        commentId: comment.id,
      })
      return toCommentDtoWithAvatar(context, comment)
    }),

  delete: authed.comments.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { id, issueId } = await deleteComment(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        userId: context.user.id,
        canDeleteOthers: context.role === 'owner',
      })
      await publishChange(context, { type: 'comment.deleted', issueId, commentId: id })
      return { id }
    }),

  react: authed.comments.react
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const comment = await reactToComment(context.db, {
        workspaceId: context.workspace.id,
        commentId: input.commentId,
        userId: context.user.id,
        emoji: input.emoji,
      })
      await publishChange(context, {
        type: 'comment.updated',
        issueId: comment.issueId,
        commentId: comment.id,
      })
      return toCommentDtoWithAvatar(context, comment)
    }),

  unreact: authed.comments.unreact
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const comment = await unreactToComment(context.db, {
        workspaceId: context.workspace.id,
        commentId: input.commentId,
        userId: context.user.id,
        emoji: input.emoji,
      })
      await publishChange(context, {
        type: 'comment.updated',
        issueId: comment.issueId,
        commentId: comment.id,
      })
      return toCommentDtoWithAvatar(context, comment)
    }),

  resolveThread: authed.comments.resolveThread
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const comment = await resolveThread(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        userId: context.user.id,
      })
      await publishChange(context, {
        type: 'comment.updated',
        issueId: comment.issueId,
        commentId: comment.id,
      })
      return toCommentDtoWithAvatar(context, comment)
    }),

  unresolveThread: authed.comments.unresolveThread
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const comment = await unresolveThread(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        userId: context.user.id,
      })
      await publishChange(context, {
        type: 'comment.updated',
        issueId: comment.issueId,
        commentId: comment.id,
      })
      return toCommentDtoWithAvatar(context, comment)
    }),
}
