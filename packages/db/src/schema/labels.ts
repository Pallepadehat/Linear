import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { teams } from './teams'
import { workspaces } from './workspaces'

export const labels = pgTable(
  'labels',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // Null = workspace label (every team); set = that team's own label.
    teamId: uuid().references(() => teams.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    // Lowercase #rrggbb; user data rendered as-is, not a design token.
    color: text().notNull(),
    ...timestamps,
  },
  (t) => [
    // Names are unique per scope: among workspace labels, and within each team.
    uniqueIndex('labels_workspace_id_name_unique')
      .on(t.workspaceId, t.name)
      .where(sql`${t.teamId} is null`),
    unique('labels_team_id_name_unique').on(t.teamId, t.name),
    check('labels_color_format', sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
  ],
)

export const issueLabels = pgTable(
  'issue_labels',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid()
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('issue_labels_issue_id_label_id_unique').on(t.issueId, t.labelId),
    index().on(t.workspaceId),
    index().on(t.labelId),
  ],
)
