import { index, integer, pgEnum, pgTable, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { workspaces } from './workspaces'

export const favoriteEntityType = pgEnum('favorite_entity_type', [
  'issue',
  'project',
  'view',
  'team',
])

/**
 * A user's personal sidebar favorites (docs/domain.md → Favorites). `entityId` is polymorphic, so
 * there is no FK to the entity: deleting an issue/project/team deletes its favorites in the same
 * transaction instead.
 */
export const favorites = pgTable(
  'favorites',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    entityType: favoriteEntityType().notNull(),
    entityId: uuid().notNull(),
    // Integer positions; new favorites go to the end, reorder rewrites them all (bounded list).
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique('favorites_user_id_entity_type_entity_id_unique').on(t.userId, t.entityType, t.entityId),
    index().on(t.userId, t.workspaceId),
    index().on(t.entityType, t.entityId),
  ],
)
