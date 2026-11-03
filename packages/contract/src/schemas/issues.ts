import { z } from 'zod'
import { workspaceScopedSchema } from './common'
import { labelSchema } from './labels'
import { workflowStatusSchema } from './teams'

/** 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low (docs/domain.md → Priorities). */
export const issuePrioritySchema = z.number().int().min(0).max(4)

/** A calendar day, `YYYY-MM-DD`, with no time or timezone (docs/domain.md → Due dates). */
export const isoDateSchema = z.iso.date({ message: 'Use a date like 2026-11-07' })
export const issueDueDateSchema = isoDateSchema.nullable()

export const issueTitleSchema = z.string().trim().min(1, { message: 'Required' }).max(255)
export const issueDescriptionSchema = z.string().max(100_000).nullable()

/** `TIP-200`, case-insensitive; normalized to an uppercase key and a number. */
export const issueIdentifierSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9]{1,9}-\d+$/, { message: 'Use an identifier like TIP-200' })
  .transform((value) => {
    const dash = value.lastIndexOf('-')
    return { teamKey: value.slice(0, dash).toUpperCase(), number: Number(value.slice(dash + 1)) }
  })

export const issueSchema = z.object({
  id: z.uuid(),
  identifier: z.string(),
  number: z.number().int(),
  teamId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: workflowStatusSchema,
  priority: issuePrioritySchema,
  assigneeId: z.uuid().nullable(),
  creatorId: z.uuid(),
  projectId: z.uuid().nullable(),
  dueDate: issueDueDateSchema,
  labels: z.array(labelSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
})

const labelIdsSchema = z.array(z.uuid()).max(50)

export const createIssueInputSchema = workspaceScopedSchema.extend({
  teamId: z.uuid(),
  title: issueTitleSchema,
  description: issueDescriptionSchema.optional(),
  /** Omitted status, priority and assignee use the team's issue defaults. */
  statusId: z.uuid().optional(),
  priority: issuePrioritySchema.optional(),
  /** `null` = unassigned, even when the team has a default assignee. */
  assigneeId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  labelIds: labelIdsSchema.optional(),
  dueDate: issueDueDateSchema.optional(),
})

/** Omitted fields are left unchanged; `labelIds` replaces the whole set. */
export const updateIssueInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  title: issueTitleSchema.optional(),
  description: issueDescriptionSchema.optional(),
  statusId: z.uuid().optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  labelIds: labelIdsSchema.optional(),
  dueDate: issueDueDateSchema.optional(),
})

export const issueIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export const getIssueByIdentifierInputSchema = workspaceScopedSchema.extend({
  identifier: issueIdentifierSchema,
})

export const issueSortSchema = z.enum(['createdAt', 'updatedAt', 'priority', 'dueDate'])
/**
 * `desc` = newest / most urgent / latest due first. No priority and no due date
 * always sort last.
 */
export const sortDirectionSchema = z.enum(['asc', 'desc'])

/**
 * `overdue`: before today and not completed or canceled. `dueThisWeek`: today through
 * Sunday. `noDueDate`: unset.
 */
export const issueDueFilterSchema = z.enum(['overdue', 'dueThisWeek', 'noDueDate'])

const filterIdsSchema = z.array(z.uuid()).max(100)
/** `null` in the list matches issues with no value (unassigned / no project). */
const nullableFilterIdsSchema = z.array(z.uuid().nullable()).max(100)

/**
 * Filters combine with AND; values within one filter with OR (labels: any of).
 * An empty list doesn't filter.
 */
export const listIssuesInputSchema = workspaceScopedSchema.extend({
  /** Scope from the page (team / project view), not a user filter. */
  teamId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  /** `'me'` narrows to issues assigned to the signed-in user (My Issues). */
  assignee: z.literal('me').optional(),
  /** `'me'` narrows to issues the signed-in user created. */
  creator: z.literal('me').optional(),
  statusIds: filterIdsSchema.optional(),
  priorities: z.array(issuePrioritySchema).max(5).optional(),
  assigneeIds: nullableFilterIdsSchema.optional(),
  projectIds: nullableFilterIdsSchema.optional(),
  labelIds: filterIdsSchema.optional(),
  /** Any of these due date buckets; `overdue` and `dueThisWeek` need `today`. */
  due: z.array(issueDueFilterSchema).max(3).optional(),
  /** The viewer's local date, so relative due filters never guess a timezone. */
  today: isoDateSchema.optional(),
  /** Title contains (case-insensitive), or an exact identifier like `tip-12`. */
  q: z.string().trim().max(255).optional(),
  sort: issueSortSchema.default('createdAt'),
  direction: sortDirectionSchema.default('desc'),
  /** `nextCursor` from the previous page. */
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const issuePageSchema = z.object({
  items: z.array(issueSchema),
  nextCursor: z.string().nullable(),
})

export type IssuePriority = z.infer<typeof issuePrioritySchema>
export type Issue = z.infer<typeof issueSchema>
export type IssuePage = z.infer<typeof issuePageSchema>
export type CreateIssueInput = z.input<typeof createIssueInputSchema>
export type UpdateIssueInput = z.input<typeof updateIssueInputSchema>
export type ListIssuesInput = z.input<typeof listIssuesInputSchema>
export type IssueSort = z.infer<typeof issueSortSchema>
export type SortDirection = z.infer<typeof sortDirectionSchema>
export type IssueDueFilter = z.infer<typeof issueDueFilterSchema>
