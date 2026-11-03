import { z } from 'zod'
import { workspaceScopedSchema } from './common'

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, { message: 'Required' })
  .max(50_000, { message: 'Comment is too long' })

export const commentAuthorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
})

export const commentSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  author: commentAuthorSchema,
  body: z.string(),
  createdAt: z.date(),
  /** Differs from `createdAt` once the body was edited. */
  updatedAt: z.date(),
})

export const listCommentsInputSchema = workspaceScopedSchema.extend({
  issueId: z.uuid(),
  /** `nextCursor` from the previous page. */
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const commentsPageSchema = z.object({
  items: z.array(commentSchema),
  nextCursor: z.string().nullable(),
})

export const createCommentInputSchema = workspaceScopedSchema.extend({
  issueId: z.uuid(),
  body: commentBodySchema,
})

export const updateCommentInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  body: commentBodySchema,
})

export const commentIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export type CommentAuthor = z.infer<typeof commentAuthorSchema>
export type Comment = z.infer<typeof commentSchema>
export type CommentsPage = z.infer<typeof commentsPageSchema>
export type ListCommentsInput = z.input<typeof listCommentsInputSchema>
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentInputSchema>
