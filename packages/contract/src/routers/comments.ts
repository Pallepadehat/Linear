import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  commentIdInputSchema,
  commentSchema,
  commentsPageSchema,
  createCommentInputSchema,
  listCommentsInputSchema,
  updateCommentInputSchema,
} from '../schemas/comments'

export const commentsContract = {
  // Unbounded, so cursor-paginated (see AGENTS.md → API). Oldest first.
  list: oc.input(listCommentsInputSchema).output(commentsPageSchema),
  create: oc.input(createCommentInputSchema).output(commentSchema),
  // Author only.
  update: oc.input(updateCommentInputSchema).output(commentSchema),
  // Author, or a workspace owner (docs/domain.md → Roles).
  delete: oc.input(commentIdInputSchema).output(z.object({ id: z.uuid() })),
}
