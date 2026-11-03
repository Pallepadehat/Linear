import { sql } from 'drizzle-orm'
import { boolean, check, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { teams } from './teams'
import { workspaces } from './workspaces'

/**
 * Saved issue views (docs/domain.md → Views): named filters + display options for the
 * workspace (`teamId` null) or one team. `filters` and `display` are parsed with the
 * contract's view schemas on read, so stale fields are dropped, never trusted.
 */
export const views = pgTable(
  'views',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // A team view goes with its team; it can't silently become a workspace view.
    teamId: uuid().references(() => teams.id, { onDelete: 'cascade' }),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    // Icon name and semantic color token key (never hex), checked by the contract.
    icon: text().notNull(),
    color: text().notNull(),
    filters: jsonb().notNull().default({}),
    display: jsonb().notNull().default({}),
    /** `false` = private: visible only to its owner. */
    shared: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index().on(t.workspaceId, t.teamId),
    check('views_name_not_blank', sql`length(trim(${t.name})) > 0`),
  ],
)
