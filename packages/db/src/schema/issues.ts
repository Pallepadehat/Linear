import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { teams, workflowStatuses } from './teams'
import { workspaces } from './workspaces'

export const issues = pgTable(
  'issues',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    // Allocated from teams.issue_counter; never reused, even after deletion.
    number: integer().notNull(),
    title: text().notNull(),
    description: text(),
    statusId: uuid()
      .notNull()
      .references(() => workflowStatuses.id),
    // 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low (docs/domain.md → Priorities).
    priority: integer().notNull().default(0),
    assigneeId: uuid().references(() => users.id, { onDelete: 'set null' }),
    creatorId: uuid()
      .notNull()
      .references(() => users.id),
    // FK to projects is added with the projects table.
    projectId: uuid(),
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('issues_team_id_number_unique').on(t.teamId, t.number),
    index().on(t.workspaceId),
    index().on(t.statusId),
    index().on(t.assigneeId),
    index().on(t.projectId),
    check('issues_number_positive', sql`${t.number} > 0`),
    check('issues_priority_range', sql`${t.priority} between 0 and 4`),
  ],
)
