import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { issues } from './issues'
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
    body: text().notNull(),
    ...timestamps,
  },
  (t) => [
    // Serves the per-issue thread, paged by (time-ordered) id.
    index().on(t.issueId, t.id),
    index().on(t.workspaceId),
    check('comments_body_not_blank', sql`length(trim(${t.body})) > 0`),
  ],
)
