import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { teams } from './teams'
import { uploads } from './uploads'
import { workspaces } from './workspaces'

export const projectStatus = pgEnum('project_status', [
  'planned',
  'in_progress',
  'completed',
  'canceled',
])
export const projects = pgTable(
  'projects',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    status: projectStatus().notNull().default('planned'),
    iconUploadId: uuid().references(() => uploads.id, { onDelete: 'set null' }),
    // 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low (same scale as issues).
    priority: smallint().notNull().default(0),
    leadId: uuid().references(() => users.id, { onDelete: 'set null' }),
    // Day resolution only, kept as `YYYY-MM-DD` strings so no time zone shifts them.
    startDate: date({ mode: 'string' }),
    targetDate: date({ mode: 'string' }),
    ...timestamps,
  },
  (t) => [
    index().on(t.workspaceId),
    check('projects_priority_range', sql`${t.priority} between 0 and 4`),
    check(
      'projects_start_before_target',
      sql`${t.startDate} is null or ${t.targetDate} is null or ${t.startDate} <= ${t.targetDate}`,
    ),
  ],
)

export const projectTeams = pgTable(
  'project_teams',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('project_teams_project_id_team_id_unique').on(t.projectId, t.teamId),
    index().on(t.workspaceId),
    index().on(t.teamId),
  ],
)

export const projectMembers = pgTable(
  'project_members',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('project_members_project_id_user_id_unique').on(t.projectId, t.userId),
    index().on(t.workspaceId),
    index().on(t.userId),
  ],
)

/** Project labels are their own set, separate from issue labels (docs/domain.md → Projects). */
export const projectLabels = pgTable(
  'project_labels',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    // Lowercase #rrggbb; user data rendered as-is, not a design token.
    color: text().notNull(),
    ...timestamps,
  },
  (t) => [
    unique('project_labels_workspace_id_name_unique').on(t.workspaceId, t.name),
    check('project_labels_color_format', sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
  ],
)

export const projectLabelAssignments = pgTable(
  'project_label_assignments',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    labelId: uuid()
      .notNull()
      .references(() => projectLabels.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('project_label_assignments_project_id_label_id_unique').on(t.projectId, t.labelId),
    index().on(t.workspaceId),
    index().on(t.labelId),
  ],
)
