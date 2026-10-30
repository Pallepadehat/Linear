import { index, pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
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
    ...timestamps,
  },
  (t) => [index().on(t.workspaceId)],
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
