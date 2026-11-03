import { z } from 'zod'
import { workspaceScopedSchema } from './common'

export const activityActorTypeSchema = z.enum(['user', 'github'])

/** Which issue field changed; `created` marks the issue's creation. */
export const activityKindSchema = z.enum([
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
  'relation',
  'cycle',
])

/**
 * Per kind: `title` text, `status`/`assignee`/`project`/`cycle` ids, `priority` number,
 * `labels` sorted label ids, `estimate` number or null, `due_date` a `YYYY-MM-DD` day (null when unset), `parent`
 * the old/new parent identifier (`TIP-12`), `sub_issue` the added (`to`) or removed
 * (`from`) sub-issue identifier, `relation` `[role, otherIssueId, otherIdentifier]` (`to`
 * when added, `from` when removed; role is `blocks`, `blocked_by`, `related`,
 * `duplicate_of` or `duplicated_by`, read from this issue's side). `created` and
 * `description` carry no values.
 */
export const activityValueSchema = z.union([z.string(), z.number(), z.array(z.string())]).nullable()

export const activitySchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  actorType: activityActorTypeSchema,
  /** Null for GitHub, or when the user was deleted. */
  actorId: z.uuid().nullable(),
  /** The PR that triggered a GitHub change; null for user changes or if the PR was removed. */
  pullRequestId: z.uuid().nullable(),
  kind: activityKindSchema,
  from: activityValueSchema,
  to: activityValueSchema,
  createdAt: z.date(),
})

export const listActivityInputSchema = workspaceScopedSchema.extend({
  issueId: z.uuid(),
  /** `nextCursor` from the previous page. */
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const activityPageSchema = z.object({
  items: z.array(activitySchema),
  nextCursor: z.string().nullable(),
})

export type ActivityActorType = z.infer<typeof activityActorTypeSchema>
export type ActivityKind = z.infer<typeof activityKindSchema>
export type Activity = z.infer<typeof activitySchema>
export type ActivityPage = z.infer<typeof activityPageSchema>
export type ListActivityInput = z.input<typeof listActivityInputSchema>
