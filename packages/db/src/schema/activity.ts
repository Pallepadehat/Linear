import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { pullRequests } from './github'
import { issues } from './issues'
import { workspaces } from './workspaces'

/** Shape depends on `kind`; see activitySchema in packages/contract. */
export type ActivityValue = string | number | string[] | null

export const activityActorType = pgEnum('activity_actor_type', ['user', 'github'])
export const activityKind = pgEnum('activity_kind', [
  'created',
  'title',
  'description',
  'status',
  'priority',
  'assignee',
  'project',
  'labels',
  'estimate',
  'due_date',
  'parent',
  'sub_issue',
])

/** One row per changed issue field (docs/domain.md → Activity). */
export const activityLog = pgTable(
  'activity_log',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    actorType: activityActorType().notNull(),
    // Null for GitHub, and for users that were deleted later.
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    // The PR whose event caused an automated change; kept null for user changes.
    pullRequestId: uuid().references(() => pullRequests.id, { onDelete: 'set null' }),
    kind: activityKind().notNull(),
    from: jsonb().$type<ActivityValue>(),
    to: jsonb().$type<ActivityValue>(),
    ...timestamps,
  },
  (t) => [
    // Serves the per-issue timeline, paged by (time-ordered) id.
    index().on(t.issueId, t.id),
    index().on(t.workspaceId),
    check(
      'activity_log_github_has_no_actor',
      sql`${t.actorType} <> 'github' or ${t.actorId} is null`,
    ),
  ],
)
