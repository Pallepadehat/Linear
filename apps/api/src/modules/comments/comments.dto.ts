import type { Comment } from '@linear/contract'
import type { CommentRecord } from '@linear/core'

export function toCommentDto(record: CommentRecord, avatarUrl: string | null): Comment {
  return {
    id: record.id,
    issueId: record.issueId,
    author: { id: record.authorId, name: record.authorName, avatarUrl },
    body: record.body,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
