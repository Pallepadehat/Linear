import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core'
import { activityActorType } from './activity'
import { users } from './auth'
import { id, timestamps } from './columns'
import { projects } from './projects'
import { workspaces } from './workspaces'

export const projectActivityKind = pgEnum('project_activity_kind', [
  'project.created',
  'project.status_changed',
  'project.priority_changed',
  'project.lead_changed',
  'project.dates_changed',
  'milestone.created',
  'milestone.completed',
  'project_update.posted',
  'project.issue_added',
  'project.issue_removed',
])

type ProjectStatusValue = (typeof projects.$inferSelect)['status']
type IssueRef = { issueId: string; identifier: string; title: string }
type MilestoneRef = { milestoneId: string; name: string }

/**
 * One project event: ids plus the from/to values needed to render it. Mirrors
 * `projectActivitySchema` in packages/contract (docs/domain.md → Project activity).
 */
export type ProjectActivityEvent =
  | { kind: 'project.created'; payload: Record<string, never> }
  | {
      kind: 'project.status_changed'
      payload: { from: ProjectStatusValue; to: ProjectStatusValue }
    }
  | { kind: 'project.priority_changed'; payload: { from: number; to: number } }
  | { kind: 'project.lead_changed'; payload: { from: string | null; to: string | null } }
  | {
      kind: 'project.dates_changed'
      payload: { field: 'startDate' | 'targetDate'; from: string | null; to: string | null }
    }
  | { kind: 'milestone.created'; payload: MilestoneRef }
  | { kind: 'milestone.completed'; payload: MilestoneRef }
  | { kind: 'project_update.posted'; payload: { updateId: string } }
  | { kind: 'project.issue_added'; payload: IssueRef }
  | { kind: 'project.issue_removed'; payload: IssueRef }

export type ProjectActivityKind = ProjectActivityEvent['kind']
export type ProjectActivityPayload = ProjectActivityEvent['payload']

/** A project's own feed, separate from the per-issue `activity_log` (docs/domain.md → Project activity). */
export const projectActivity = pgTable(
  'project_activity',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    actorType: activityActorType().notNull(),
    // Null for GitHub, and for users that were deleted later.
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    kind: projectActivityKind().notNull(),
    payload: jsonb().$type<ProjectActivityPayload>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    // Serves the per-project feed, paged by (time-ordered) id.
    index().on(t.projectId, t.id),
    index().on(t.workspaceId),
    check(
      'project_activity_github_has_no_actor',
      sql`${t.actorType} <> 'github' or ${t.actorId} is null`,
    ),
  ],
)
