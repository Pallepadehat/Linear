import { sql } from 'drizzle-orm'
import { check, index, integer, pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { workspaces } from './workspaces'

export const statusCategory = pgEnum('status_category', [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
])

export const teams = pgTable(
  'teams',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    key: text().notNull(),
    // Last allocated issue number; bumped with UPDATE … RETURNING in the create transaction.
    issueCounter: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique('teams_workspace_id_key_unique').on(t.workspaceId, t.key),
    index().on(t.workspaceId),
    check('teams_key_format', sql`${t.key} ~ '^[A-Z][A-Z0-9]{1,9}$'`),
    check('teams_issue_counter_non_negative', sql`${t.issueCounter} >= 0`),
  ],
)

export const teamMembers = pgTable(
  'team_members',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('team_members_team_id_user_id_unique').on(t.teamId, t.userId),
    index().on(t.workspaceId),
    index().on(t.userId),
  ],
)

export const workflowStatuses = pgTable(
  'workflow_statuses',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    category: statusCategory().notNull(),
    position: integer().notNull(),
    ...timestamps,
  },
  (t) => [
    unique('workflow_statuses_team_id_name_unique').on(t.teamId, t.name),
    index().on(t.workspaceId),
    index().on(t.teamId),
  ],
)
