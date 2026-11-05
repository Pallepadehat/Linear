import { index, pgEnum, pgTable, text, unique, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { uploads } from './uploads'

export const workspaceRole = pgEnum('workspace_role', ['owner', 'member'])

export const workspaces = pgTable('workspaces', {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  createdById: uuid()
    .notNull()
    .references(() => users.id),
  iconUploadId: uuid().references((): AnyPgColumn => uploads.id, { onDelete: 'set null' }),
  /** Code people enter to join as a member; null while joining by code is turned off. */
  inviteCode: text().unique('workspaces_invite_code_unique'),
  ...timestamps,
})

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRole().notNull().default('member'),
    ...timestamps,
  },
  (t) => [
    unique('workspace_members_workspace_id_user_id_unique').on(t.workspaceId, t.userId),
    index().on(t.workspaceId),
    index().on(t.userId),
  ],
)
