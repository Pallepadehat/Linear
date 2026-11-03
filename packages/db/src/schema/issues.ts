import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { projects } from './projects'
import { teams, workflowStatuses } from './teams'
import { uploads } from './uploads'
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
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    // A calendar day (YYYY-MM-DD), no time or timezone (docs/domain.md → Due dates).
    dueDate: date({ mode: 'string' }),
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('issues_team_id_number_unique').on(t.teamId, t.number),
    index().on(t.workspaceId),
    index().on(t.statusId),
    index().on(t.assigneeId),
    index().on(t.projectId),
    // List filters and sorts (issues.list); the id is the keyset tie-breaker.
    index().on(t.workspaceId, t.priority),
    index().on(t.workspaceId, t.createdAt, t.id),
    index().on(t.workspaceId, t.updatedAt, t.id),
    index().on(t.workspaceId, t.dueDate, t.id),
    check('issues_number_positive', sql`${t.number} > 0`),
    check('issues_priority_range', sql`${t.priority} between 0 and 4`),
  ],
)

/**
 * `attachment` uploads referenced from an issue description (`attachment:<uploadId>`),
 * kept in sync on every description write. An upload may be referenced by several
 * issues; it is deleted once no link remains (docs/domain.md → Uploads).
 */
export const issueAttachments = pgTable(
  'issue_attachments',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    uploadId: uuid()
      .notNull()
      .references(() => uploads.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('issue_attachments_issue_id_upload_id_unique').on(t.issueId, t.uploadId),
    index().on(t.workspaceId),
    index().on(t.uploadId),
  ],
)
