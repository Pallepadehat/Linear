import { z } from 'zod'
import { workspaceScopedSchema } from './common'

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, { message: 'Required' })
  .max(50_000, { message: 'Comment is too long' })

/**
 * The emojis a comment can be reacted with, each with search keywords for the picker.
 * A bounded allowlist keeps reactions to one well-known grapheme each
 * (docs/domain.md → Comments). The first six are the picker's "Frequently used" row.
 */
export const REACTION_EMOJIS = [
  { emoji: '👍', keywords: 'thumbs up +1 yes like' },
  { emoji: '❤️', keywords: 'heart love' },
  { emoji: '😄', keywords: 'smile happy laugh' },
  { emoji: '🎉', keywords: 'tada party celebrate hooray' },
  { emoji: '👀', keywords: 'eyes look watching' },
  { emoji: '🚀', keywords: 'rocket ship launch' },
  { emoji: '👎', keywords: 'thumbs down -1 no dislike' },
  { emoji: '😕', keywords: 'confused unsure' },
  { emoji: '🙏', keywords: 'pray thanks please' },
  { emoji: '👏', keywords: 'clap applause' },
  { emoji: '🙌', keywords: 'raised hands hooray' },
  { emoji: '💯', keywords: 'hundred perfect' },
  { emoji: '🔥', keywords: 'fire hot lit' },
  { emoji: '✅', keywords: 'check done yes' },
  { emoji: '❌', keywords: 'cross no wrong' },
  { emoji: '⚠️', keywords: 'warning caution' },
  { emoji: '🐛', keywords: 'bug insect' },
  { emoji: '💡', keywords: 'bulb idea' },
  { emoji: '🤔', keywords: 'thinking hmm' },
  { emoji: '😂', keywords: 'joy tears laugh lol' },
  { emoji: '😅', keywords: 'sweat smile phew' },
  { emoji: '😍', keywords: 'heart eyes love' },
  { emoji: '😎', keywords: 'cool sunglasses' },
  { emoji: '😢', keywords: 'cry sad tear' },
  { emoji: '😮', keywords: 'wow surprised open mouth' },
  { emoji: '😬', keywords: 'grimace awkward' },
  { emoji: '🤯', keywords: 'mind blown exploding' },
  { emoji: '🥳', keywords: 'party celebrate' },
  { emoji: '🙈', keywords: 'see no evil monkey' },
  { emoji: '👋', keywords: 'wave hello hi bye' },
  { emoji: '💪', keywords: 'muscle strong flex' },
  { emoji: '🤝', keywords: 'handshake deal agree' },
  { emoji: '👌', keywords: 'ok okay perfect' },
  { emoji: '✨', keywords: 'sparkles shiny new' },
  { emoji: '⭐', keywords: 'star favorite' },
  { emoji: '🏆', keywords: 'trophy win award' },
  { emoji: '🎯', keywords: 'target bullseye goal' },
  { emoji: '📌', keywords: 'pin pushpin' },
  { emoji: '📝', keywords: 'memo note write' },
  { emoji: '🔒', keywords: 'lock secure' },
  { emoji: '⏰', keywords: 'alarm clock time' },
  { emoji: '🚧', keywords: 'construction wip' },
  { emoji: '🧪', keywords: 'test tube experiment' },
  { emoji: '☕', keywords: 'coffee break' },
  { emoji: '🍕', keywords: 'pizza food' },
  { emoji: '🐢', keywords: 'turtle slow' },
  { emoji: '⚡', keywords: 'zap lightning fast' },
  { emoji: '💀', keywords: 'skull dead' },
] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]['emoji']

export const reactionEmojiSchema = z.enum(
  REACTION_EMOJIS.map((e) => e.emoji) as [ReactionEmoji, ...ReactionEmoji[]],
  { message: 'Unsupported reaction' },
)

const reactionEmojiSet: ReadonlySet<string> = new Set(REACTION_EMOJIS.map((e) => e.emoji))
export const isReactionEmoji = (emoji: string): emoji is ReactionEmoji =>
  reactionEmojiSet.has(emoji)

/** Most replies a thread returns with `comments.list`; `replyCount` has the total. */
export const MAX_THREAD_REPLIES = 50

export const commentAuthorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
})

export const commentReactionSchema = z.object({
  emoji: reactionEmojiSchema,
  count: z.number().int().positive(),
  reactedByMe: z.boolean(),
})

export const commentSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  /** The thread root this replies to; `null` for a root. */
  parentId: z.uuid().nullable(),
  author: commentAuthorSchema,
  body: z.string(),
  /** In order of the first reaction with each emoji. */
  reactions: z.array(commentReactionSchema),
  /** Only ever set on thread roots. */
  resolvedAt: z.date().nullable(),
  createdAt: z.date(),
  /** Differs from `createdAt` once the body was edited. */
  updatedAt: z.date(),
})

/** A root comment with its replies, oldest first (at most `MAX_THREAD_REPLIES`). */
export const commentThreadSchema = commentSchema.extend({
  replies: z.array(commentSchema),
  replyCount: z.number().int().nonnegative(),
})

export const listCommentsInputSchema = workspaceScopedSchema.extend({
  issueId: z.uuid(),
  /** `nextCursor` from the previous page. */
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(100).default(50),
})

/** Pages over thread roots. */
export const commentsPageSchema = z.object({
  items: z.array(commentThreadSchema),
  nextCursor: z.string().nullable(),
})

export const createCommentInputSchema = workspaceScopedSchema.extend({
  issueId: z.uuid(),
  /** Reply to this thread root. */
  parentId: z.uuid().nullish(),
  body: commentBodySchema,
})

export const updateCommentInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  body: commentBodySchema,
})

export const commentIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export const commentReactionInputSchema = workspaceScopedSchema.extend({
  commentId: z.uuid(),
  emoji: reactionEmojiSchema,
})

export type CommentAuthor = z.infer<typeof commentAuthorSchema>
export type CommentReaction = z.infer<typeof commentReactionSchema>
export type Comment = z.infer<typeof commentSchema>
export type CommentThread = z.infer<typeof commentThreadSchema>
export type CommentsPage = z.infer<typeof commentsPageSchema>
export type ListCommentsInput = z.input<typeof listCommentsInputSchema>
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentInputSchema>
export type CommentReactionInput = z.infer<typeof commentReactionInputSchema>
