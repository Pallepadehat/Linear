import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { projects } from './projects'
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

/**
 * A project's Resources: web links like issue links, kept in a user-visible order
 * (`sortOrder`, new links last; docs/domain.md → Links).
 */
export const projectLinks = pgTable(
  'project_links',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    title: text().notNull(),
    sortOrder: integer().notNull().default(0),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index().on(t.projectId, t.sortOrder), index().on(t.workspaceId)],
)
