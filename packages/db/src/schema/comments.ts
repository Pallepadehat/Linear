import { sql } from 'drizzle-orm'
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { uploads } from './uploads'
import { workspaces } from './workspaces'

export const comments = pgTable(
  'comments',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    /**
     * The thread root this comment replies to. One level only: core checks the parent
     * has no parent itself and is on the same issue (docs/domain.md → Comments).
     */
    parentId: uuid().references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    /** Set on thread roots only. */
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    // Serves the per-issue thread, paged by (time-ordered) id.
    index().on(t.issueId, t.id),
    // Replies of a page of roots, oldest first.
    index().on(t.parentId, t.id),
    index().on(t.workspaceId),
    check('comments_body_not_blank', sql`length(trim(${t.body})) > 0`),
  ],
)

export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text().notNull(),
    ...timestamps,
  },
  (t) => [
    // Also serves loading the reactions of a page of comments.
    unique('comment_reactions_comment_id_user_id_emoji_unique').on(t.commentId, t.userId, t.emoji),
    index().on(t.workspaceId),
  ],
)

/**
 * `attachment` uploads referenced from a comment body (`attachment:<uploadId>`), kept in
 * sync on every body write, like `issue_attachments`. An upload is deleted once no issue
 * or comment links it (docs/domain.md → Uploads).
 */
export const commentAttachments = pgTable(
  'comment_attachments',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    uploadId: uuid()
      .notNull()
      .references(() => uploads.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('comment_attachments_comment_id_upload_id_unique').on(t.commentId, t.uploadId),
    index().on(t.workspaceId),
    index().on(t.uploadId),
  ],
)
