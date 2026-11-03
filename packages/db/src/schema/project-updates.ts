import { index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { projects } from './projects'
import { workspaces } from './workspaces'

export const projectHealth = pgEnum('project_health', ['on_track', 'at_risk', 'off_track'])

/**
 * A member's status report on a project. The latest one sets the project's health
 * (docs/domain.md → Project updates).
 */
export const projectUpdates = pgTable(
  'project_updates',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    health: projectHealth().notNull(),
    // Markdown, like issue descriptions and comments.
    body: text().notNull(),
    ...timestamps,
  },
  (t) => [
    // Serves the feed (newest first) and the latest-update-per-project health lookup.
    index().on(t.projectId, t.createdAt),
    index().on(t.workspaceId),
  ],
)
