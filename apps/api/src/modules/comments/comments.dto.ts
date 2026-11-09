import { isReactionEmoji, type Comment, type CommentReaction } from '@linear/contract'
import type { CommentRecord } from '@linear/core'

export function toCommentDto(record: CommentRecord, avatarUrl: string | null): Comment {
  return {
    id: record.id,
    issueId: record.issueId,
    parentId: record.parentId,
    author: { id: record.authorId, name: record.authorName, avatarUrl },
    body: record.body,
    reactions: record.reactions.flatMap(({ emoji, count, reactedByMe }): CommentReaction[] =>
      // Stored emojis only come through the contract's allowlist; skip any it later drops.
      isReactionEmoji(emoji) ? [{ emoji, count, reactedByMe }] : [],
    ),
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
