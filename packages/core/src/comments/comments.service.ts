import { commentReactions, comments, issues, users, type DbOrTx } from '@linear/db'
import { and, asc, count, eq, gt, inArray, isNull, lte, min, sql, type SQL } from 'drizzle-orm'
import { assertCursor } from '../cursor'
import { DomainError } from '../errors'
import { assertReplyParent } from './threads'
import {
  listCommentAttachmentIds,
  releaseAttachments,
  syncCommentAttachments,
} from '../issues/attachments'
import { syncMentions, type MentionsResult } from '../mentions/mentions.service'
import { subscribeUsers } from '../subscriptions/subscriptions.service'

export type ListCommentsInput = {
  workspaceId: string
  issueId: string
  /** Whose reactions count as `reactedByMe`. */
  viewerId: string
  cursor?: string | null
  limit: number
  /** Most replies returned per thread. */
  maxReplies: number
}

export type CreateCommentInput = {
  workspaceId: string
  issueId: string
  authorId: string
  /** Reply to this thread root. */
  parentId?: string | null
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

export type CommentReactionInput = {
  workspaceId: string
  commentId: string
  userId: string
  emoji: string
}

export type ResolveThreadInput = {
  workspaceId: string
  id: string
  userId: string
}

const commentColumns = {
  id: comments.id,
  issueId: comments.issueId,
  parentId: comments.parentId,
  authorId: comments.authorId,
  body: comments.body,
  resolvedAt: comments.resolvedAt,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  authorName: users.name,
  authorAvatarUploadId: users.avatarUploadId,
}

export type ReactionSummary = { emoji: string; count: number; reactedByMe: boolean }

/** A comment with what the UI needs to render its author and reactions. */
export type CommentRecord = {
  id: string
  issueId: string
  parentId: string | null
  authorId: string
  body: string
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  authorName: string
  authorAvatarUploadId: string | null
  reactions: ReactionSummary[]
}

export type CommentThreadRecord = CommentRecord & {
  replies: CommentRecord[]
  replyCount: number
}

// `updatedAt` marks body edits ("edited"); resolving a thread isn't one.
const keepUpdatedAt = sql`${comments.updatedAt}`

type CommentRow = Omit<CommentRecord, 'reactions'>

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

/** Reactions per comment, each emoji in the order it was first used. */
async function reactionsOf(
  db: DbOrTx,
  workspaceId: string,
  commentIds: string[],
  viewerId: string,
) {
  const byComment = new Map<string, ReactionSummary[]>()
  if (commentIds.length === 0) return byComment
  const rows = await db
    .select({
      commentId: commentReactions.commentId,
      emoji: commentReactions.emoji,
      count: count(),
      reactedByMe: sql<boolean>`bool_or(${commentReactions.userId} = ${viewerId})`.mapWith(Boolean),
    })
    .from(commentReactions)
    .where(
      and(
        eq(commentReactions.workspaceId, workspaceId),
        inArray(commentReactions.commentId, commentIds),
      ),
    )
    .groupBy(commentReactions.commentId, commentReactions.emoji)
    .orderBy(min(commentReactions.createdAt), commentReactions.emoji)
  for (const { commentId, ...reaction } of rows) {
    const list = byComment.get(commentId) ?? []
    list.push(reaction)
    byComment.set(commentId, list)
  }
  return byComment
}

async function withReactions(
  db: DbOrTx,
  workspaceId: string,
  rows: CommentRow[],
  viewerId: string,
): Promise<CommentRecord[]> {
  const reactions = await reactionsOf(
    db,
    workspaceId,
    rows.map((r) => r.id),
    viewerId,
  )
  return rows.map((r) => ({ ...r, reactions: reactions.get(r.id) ?? [] }))
}

async function getComment(
  db: DbOrTx,
  workspaceId: string,
  id: string,
  viewerId: string,
): Promise<CommentRecord> {
  const [row] = await selectComments(
    db,
    and(eq(comments.workspaceId, workspaceId), eq(comments.id, id)),
  )
  if (!row) throw new DomainError('NOT_FOUND', 'Comment not found')
  const [comment] = await withReactions(db, workspaceId, [row], viewerId)
  return comment!
}

async function assertIssue(db: DbOrTx, workspaceId: string, issueId: string) {
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
}

/** The first `maxReplies` replies of each root, oldest first, plus each root's total. */
async function repliesOf(db: DbOrTx, workspaceId: string, rootIds: string[], maxReplies: number) {
  if (rootIds.length === 0) return { replies: [], counts: new Map<string, number>() }
  const inThreads = and(eq(comments.workspaceId, workspaceId), inArray(comments.parentId, rootIds))
  const ranked = db
    .select({
      ...commentColumns,
      rank: sql<number>`row_number() over (partition by ${comments.parentId} order by ${comments.id})`.as(
        'rank',
      ),
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(inThreads)
    .as('ranked')
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: ranked.id,
        issueId: ranked.issueId,
        parentId: ranked.parentId,
        authorId: ranked.authorId,
        body: ranked.body,
        resolvedAt: ranked.resolvedAt,
        createdAt: ranked.createdAt,
        updatedAt: ranked.updatedAt,
        authorName: ranked.authorName,
        authorAvatarUploadId: ranked.authorAvatarUploadId,
      })
      .from(ranked)
      .where(lte(ranked.rank, maxReplies))
      .orderBy(asc(ranked.id)),
    db
      .select({ parentId: comments.parentId, count: count() })
      .from(comments)
      .where(inThreads)
      .groupBy(comments.parentId),
  ])
  return {
    replies: rows,
    counts: new Map(totals.map((t) => [t.parentId!, t.count])),
  }
}

/**
 * Pages over thread roots, oldest first; each carries its first `maxReplies` replies.
 * Ids are UUIDv7, so paging by id follows creation order.
 */
export async function listComments(db: DbOrTx, input: ListCommentsInput) {
  assertCursor(input.cursor)
  await assertIssue(db, input.workspaceId, input.issueId)

  const rows = await selectComments(
    db,
    and(
      eq(comments.workspaceId, input.workspaceId),
      eq(comments.issueId, input.issueId),
      isNull(comments.parentId),
      input.cursor ? gt(comments.id, input.cursor) : undefined,
    ),
  )
    .orderBy(asc(comments.id))
    .limit(input.limit + 1)
  const roots = rows.slice(0, input.limit)
  const nextCursor = rows.length > input.limit ? (roots.at(-1)?.id ?? null) : null

  const { replies, counts } = await repliesOf(
    db,
    input.workspaceId,
    roots.map((r) => r.id),
    input.maxReplies,
  )
  const records = await withReactions(db, input.workspaceId, [...roots, ...replies], input.viewerId)
  const byId = new Map(records.map((r) => [r.id, r]))
  const items: CommentThreadRecord[] = roots.map((root) => ({
    ...byId.get(root.id)!,
    replies: replies.filter((r) => r.parentId === root.id).map((r) => byId.get(r.id)!),
    replyCount: counts.get(root.id) ?? 0,
  }))
  return { items, nextCursor }
}

export async function createComment(db: DbOrTx, input: CreateCommentInput) {
  const body = normalizeBody(input.body)
  await assertIssue(db, input.workspaceId, input.issueId)
  const { id, mentions } = await db.transaction(async (tx) => {
    if (input.parentId) {
      const [parent] = await tx
        .select({ issueId: comments.issueId, parentId: comments.parentId })
        .from(comments)
        .where(and(eq(comments.workspaceId, input.workspaceId), eq(comments.id, input.parentId)))
      assertReplyParent(parent, input.issueId)
      // A reply reopens a resolved thread (docs/domain.md → Comments).
      await tx
        .update(comments)
        .set({ resolvedAt: null, resolvedById: null, updatedAt: keepUpdatedAt })
        .where(and(eq(comments.workspaceId, input.workspaceId), eq(comments.id, input.parentId)))
    }
    const [comment] = await tx
      .insert(comments)
      .values({
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        authorId: input.authorId,
        parentId: input.parentId ?? null,
        body,
      })
      .returning({ id: comments.id })
    if (!comment) throw new Error('comment insert returned no row')
    await syncCommentAttachments(tx, input.workspaceId, comment.id, body)
    await subscribeUsers(tx, input.issueId, [input.authorId])
    const mentions = await syncMentions(tx, {
      workspaceId: input.workspaceId,
      issueId: input.issueId,
      actorId: input.authorId,
      before: null,
      after: body,
      commentId: comment.id,
    })
    return { id: comment.id, mentions }
  })
  return { ...(await getComment(db, input.workspaceId, id, input.authorId)), mentions }
}

export async function updateComment(db: DbOrTx, input: UpdateCommentInput) {
  const body = normalizeBody(input.body)
  const existing = await getComment(db, input.workspaceId, input.id, input.userId)
  if (existing.authorId !== input.userId) {
    throw new DomainError('FORBIDDEN', 'You can only edit your own comments')
  }
  if (existing.body === body) return { ...existing, mentions: noMentions }

  const mentions = await db.transaction(async (tx) => {
    await tx
      .update(comments)
      .set({ body })
      .where(and(eq(comments.workspaceId, input.workspaceId), eq(comments.id, input.id)))
    await syncCommentAttachments(tx, input.workspaceId, input.id, body)
    return syncMentions(tx, {
      workspaceId: input.workspaceId,
      issueId: existing.issueId,
      actorId: input.userId,
      before: existing.body,
      after: body,
      commentId: existing.id,
    })
  })
  return { ...(await getComment(db, input.workspaceId, input.id, input.userId)), mentions }
}

const noMentions: MentionsResult = { userIds: [], mentionedIssueIds: [] }

/**
 * Deleting a thread root deletes its replies (FK cascade). Attachments no issue or
 * comment links anymore are marked deleted; the caller enqueues `delete-objects` for
 * each `deletedUploadIds` entry after the commit.
 */
export async function deleteComment(db: DbOrTx, input: DeleteCommentInput) {
  const existing = await getComment(db, input.workspaceId, input.id, input.userId)
  if (existing.authorId !== input.userId && !input.canDeleteOthers) {
    throw new DomainError('FORBIDDEN', "You can't delete other people's comments")
  }
  const deletedUploadIds = await db.transaction(async (tx) => {
    const attachmentIds = await listCommentAttachmentIds(tx, input.workspaceId, input.id)
    await tx
      .delete(comments)
      .where(and(eq(comments.workspaceId, input.workspaceId), eq(comments.id, input.id)))
    return releaseAttachments(tx, input.workspaceId, attachmentIds)
  })
  return { id: existing.id, issueId: existing.issueId, deletedUploadIds }
}

/** Idempotent: reacting again with the same emoji changes nothing. */
export async function reactToComment(db: DbOrTx, input: CommentReactionInput) {
  await getComment(db, input.workspaceId, input.commentId, input.userId)
  await db
    .insert(commentReactions)
    .values({
      workspaceId: input.workspaceId,
      commentId: input.commentId,
      userId: input.userId,
      emoji: input.emoji,
    })
    .onConflictDoNothing({
      target: [commentReactions.commentId, commentReactions.userId, commentReactions.emoji],
    })
  return getComment(db, input.workspaceId, input.commentId, input.userId)
}

/** Idempotent: removing a reaction that isn't there changes nothing. */
export async function unreactToComment(db: DbOrTx, input: CommentReactionInput) {
  await getComment(db, input.workspaceId, input.commentId, input.userId)
  await db
    .delete(commentReactions)
    .where(
      and(
        eq(commentReactions.workspaceId, input.workspaceId),
        eq(commentReactions.commentId, input.commentId),
        eq(commentReactions.userId, input.userId),
        eq(commentReactions.emoji, input.emoji),
      ),
    )
  return getComment(db, input.workspaceId, input.commentId, input.userId)
}

async function setResolved(db: DbOrTx, input: ResolveThreadInput, resolved: boolean) {
  const existing = await getComment(db, input.workspaceId, input.id, input.userId)
  if (existing.parentId !== null) {
    throw new DomainError('BAD_REQUEST', 'Only a thread can be resolved, not a reply')
  }
  if (Boolean(existing.resolvedAt) === resolved) return existing
  await db
    .update(comments)
    .set(
      resolved
        ? { resolvedAt: new Date(), resolvedById: input.userId, updatedAt: keepUpdatedAt }
        : { resolvedAt: null, resolvedById: null, updatedAt: keepUpdatedAt },
    )
    .where(and(eq(comments.workspaceId, input.workspaceId), eq(comments.id, input.id)))
  return getComment(db, input.workspaceId, input.id, input.userId)
}

export const resolveThread = (db: DbOrTx, input: ResolveThreadInput) => setResolved(db, input, true)
export const unresolveThread = (db: DbOrTx, input: ResolveThreadInput) =>
  setResolved(db, input, false)
