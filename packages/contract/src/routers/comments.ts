import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  commentIdInputSchema,
  commentReactionInputSchema,
  commentSchema,
  commentsPageSchema,
  createCommentInputSchema,
  listCommentsInputSchema,
  updateCommentInputSchema,
} from '../schemas/comments'

export const commentsContract = {
  // Unbounded, so cursor-paginated over thread roots (see AGENTS.md → API). Oldest first.
  list: oc.input(listCommentsInputSchema).output(commentsPageSchema),
  // With `parentId`, a reply to that thread root (one level deep).
  create: oc.input(createCommentInputSchema).output(commentSchema),
  // Author only.
  update: oc.input(updateCommentInputSchema).output(commentSchema),
  // Author, or a workspace owner (docs/domain.md → Roles). Removes the replies too.
  delete: oc.input(commentIdInputSchema).output(z.object({ id: z.uuid() })),
  // Idempotent: reacting twice with the same emoji, or unreacting without a reaction, is a no-op.
  react: oc.input(commentReactionInputSchema).output(commentSchema),
  unreact: oc.input(commentReactionInputSchema).output(commentSchema),
  // Thread roots only; any member.
  resolveThread: oc.input(commentIdInputSchema).output(commentSchema),
  unresolveThread: oc.input(commentIdInputSchema).output(commentSchema),
}
