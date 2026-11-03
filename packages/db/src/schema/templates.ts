import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { projects } from './projects'
import { teams, workflowStatuses } from './teams'
import { workspaces } from './workspaces'

/**
 * Prefills for the create-issue dialog (docs/domain.md → Templates). `teamId` null is a
 * workspace template. Templates never create issues themselves; every property is optional.
 */
export const issueTemplates = pgTable(
  'issue_templates',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // A team template goes with its team; it can't silently become a workspace template.
    teamId: uuid().references(() => teams.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    title: text().notNull().default(''),
    description: text(),
    statusId: uuid().references(() => workflowStatuses.id, { onDelete: 'set null' }),
    // 0 No priority … 4 Low; null leaves the dialog's priority alone.
    priority: integer(),
    assigneeId: uuid().references(() => users.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    // No FK on array elements: deleted labels are filtered out on read.
    labelIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    // NULLS NOT DISTINCT so workspace templates (team null) can't share a name either.
    unique('issue_templates_workspace_id_team_id_name_unique')
      .on(t.workspaceId, t.teamId, t.name)
      .nullsNotDistinct(),
    index().on(t.teamId),
    check(
      'issue_templates_priority_range',
      sql`${t.priority} is null or ${t.priority} between 0 and 4`,
    ),
  ],
)
