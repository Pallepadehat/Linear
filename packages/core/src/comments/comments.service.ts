import { comments, issues, users, type DbOrTx } from '@linear/db'
import { and, asc, eq, gt, type SQL } from 'drizzle-orm'
import { assertCursor } from '../cursor'
import { DomainError } from '../errors'

export type ListCommentsInput = {
  workspaceId: string
  issueId: string
  cursor?: string | null
  limit: number
}

export type CreateCommentInput = {
  workspaceId: string
  issueId: string
  authorId: string
  body: string
}

export type UpdateCommentInput = {
  workspaceId: string
  id: string
  /** The user making the edit; only the author may. */
  userId: string
  body: string
}

export type DeleteCommentInput = {
  workspaceId: string
  id: string
  userId: string
  /** Workspace owners may delete anyone's comment (docs/domain.md → Roles). */
  canDeleteOthers: boolean
}

const commentColumns = {
  id: comments.id,
  issueId: comments.issueId,
  authorId: comments.authorId,
  body: comments.body,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  authorName: users.name,
  authorAvatarUploadId: users.avatarUploadId,
}

/** A comment with what the UI needs to render its author. */
export type CommentRecord = {
  id: string
  issueId: string
  authorId: string
  body: string
  createdAt: Date
  updatedAt: Date
  authorName: string
  authorAvatarUploadId: string | null
}

function normalizeBody(body: string) {
  const trimmed = body.trim()
  if (trimmed.length === 0) throw new DomainError('BAD_REQUEST', 'Comment cannot be empty')
  return trimmed
}

function selectComments(db: DbOrTx, where: SQL | undefined) {
  return db
    .select(commentColumns)
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(where)
}

async function getComment(db: DbOrTx, workspaceId: string, id: string): Promise<CommentRecord> {
  const [comment] = await selectComments(
    db,
    and(eq(comments.workspaceId, workspaceId), eq(comments.id, id)),
  )
  if (!comment) throw new DomainError('NOT_FOUND', 'Comment not found')
  return comment
}

async function assertIssue(db: DbOrTx, workspaceId: string, issueId: string) {
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
}

/** Oldest first. Ids are UUIDv7, so paging by id follows creation order. */
export async function listComments(db: DbOrTx, input: ListCommentsInput) {
  assertCursor(input.cursor)
  await assertIssue(db, input.workspaceId, input.issueId)

  const rows = await selectComments(
    db,
    and(
      eq(comments.workspaceId, input.workspaceId),
      eq(comments.issueId, input.issueId),
      input.cursor ? gt(comments.id, input.cursor) : undefined,
    ),
  )
    .orderBy(asc(comments.id))
    .limit(input.limit + 1)
  const items: CommentRecord[] = rows.slice(0, input.limit)
  const nextCursor = rows.length > input.limit ? (items.at(-1)?.id ?? null) : null
  return { items, nextCursor }
}

export async function createComment(db: DbOrTx, input: CreateCommentInput) {
  const body = normalizeBody(input.body)
  await assertIssue(db, input.workspaceId, input.issueId)
  const [comment] = await db
    .insert(comments)
    .values({
      workspaceId: input.workspaceId,
      issueId: input.issueId,
      authorId: input.authorId,
      body,
    })
    .returning({ id: comments.id })
  if (!comment) throw new Error('comment insert returned no row')
  return getComment(db, input.workspaceId, comment.id)
}

export async function updateComment(db: DbOrTx, input: UpdateCommentInput) {
  const body = normalizeBody(input.body)
  const existing = await getComment(db, input.workspaceId, input.id)
  if (existing.authorId !== input.userId) {
    throw new DomainError('FORBIDDEN', 'You can only edit your own comments')
  }
  if (existing.body === body) return existing

  await db
    .update(comments)
    .set({ body })
    .where(and(eq(comments.workspaceId, input.workspaceId), eq(comments.id, input.id)))
  return getComment(db, input.workspaceId, input.id)
}

export async function deleteComment(db: DbOrTx, input: DeleteCommentInput) {
  const existing = await getComment(db, input.workspaceId, input.id)
  if (existing.authorId !== input.userId && !input.canDeleteOthers) {
    throw new DomainError('FORBIDDEN', "You can't delete other people's comments")
  }
  await db
    .delete(comments)
    .where(and(eq(comments.workspaceId, input.workspaceId), eq(comments.id, input.id)))
  return { id: existing.id, issueId: existing.issueId }
}
