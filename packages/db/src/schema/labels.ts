import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { workspaces } from './workspaces'

export const labels = pgTable(
  'labels',
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
    unique('labels_workspace_id_name_unique').on(t.workspaceId, t.name),
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
