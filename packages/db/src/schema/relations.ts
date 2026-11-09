import { sql } from 'drizzle-orm'
import { check, index, pgEnum, pgTable, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { workspaces } from './workspaces'

export const issueRelationType = pgEnum('issue_relation_type', ['blocks', 'related', 'duplicate'])

/**
 * Directed: `blocks` = issueId blocks relatedIssueId, `duplicate` = issueId is a
 * duplicate of relatedIssueId. Each pair has at most one relation of a type, in
 * either direction (docs/domain.md → Relations).
 */
export const issueRelations = pgTable(
  'issue_relations',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    relatedIssueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    type: issueRelationType().notNull(),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    unique('issue_relations_issue_id_related_issue_id_type_unique').on(
      t.issueId,
      t.relatedIssueId,
      t.type,
    ),
    // The reverse pair counts as the same relation; this closes the race between
    // two members relating A→B and B→A at once.
    uniqueIndex('issue_relations_pair_type_unique').on(
      sql`least(${t.issueId}, ${t.relatedIssueId})`,
      sql`greatest(${t.issueId}, ${t.relatedIssueId})`,
      t.type,
    ),
    index().on(t.relatedIssueId),
    index().on(t.workspaceId),
    check('issue_relations_not_self', sql`${t.issueId} <> ${t.relatedIssueId}`),
  ],
)
