import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { workspaces } from './workspaces'

/**
 * Web links attached to an issue (docs/domain.md → Links). Only `http(s)` URLs;
 * the title is stored resolved (the hostname when the user left it empty).
 */
export const issueLinks = pgTable(
  'issue_links',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    title: text().notNull(),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index().on(t.issueId), index().on(t.workspaceId)],
)
