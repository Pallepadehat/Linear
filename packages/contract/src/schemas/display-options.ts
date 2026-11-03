import { z } from 'zod'
import { issueSortSchema, sortDirectionSchema } from './issues'

/**
 * Display options of an issue view (docs/domain.md → Display options): how the
 * loaded issues are laid out, grouped, ordered and trimmed. Stored per view in the
 * browser today; saved views (M10-05) can persist the same shape.
 */

export const ISSUE_LAYOUTS = ['list', 'board'] as const
export const ISSUE_GROUPINGS = [
  'status',
  'assignee',
  'priority',
  'project',
  'label',
  'none',
] as const
export const COMPLETED_ISSUE_WINDOWS = ['all', 'day', 'week', 'month', 'none'] as const
/** Row and card properties, in the order the chips are shown. */
export const DISPLAY_PROPERTIES = [
  'id',
  'status',
  'assignee',
  'priority',
  'project',
  'dueDate',
  'milestone',
  'labels',
  'links',
  'estimate',
  'createdAt',
  'updatedAt',
  'pullRequests',
] as const

export const issueLayoutSchema = z.enum(ISSUE_LAYOUTS)
export const issueGroupingSchema = z.enum(ISSUE_GROUPINGS)
/** `all` keeps every finished issue, `none` hides them, the rest keep recently finished ones. */
export const completedIssuesSchema = z.enum(COMPLETED_ISSUE_WINDOWS)
export const displayPropertySchema = z.enum(DISPLAY_PROPERTIES)

export const displayOptionsSchema = z.object({
  layout: issueLayoutSchema,
  grouping: issueGroupingSchema,
  /** `asc` is each grouping's natural order (workflow, Urgent → Low, A → Z); "No …" stays last. */
  groupDirection: sortDirectionSchema,
  /** List only; `none` or the same as `grouping` means no sub-groups. */
  subGrouping: issueGroupingSchema,
  ordering: issueSortSchema,
  orderDirection: sortDirectionSchema,
  /** Within a group, finished issues come after open ones, most recently finished first. */
  orderCompletedByRecency: z.boolean(),
  completedIssues: completedIssuesSchema,
  showSubIssues: z.boolean(),
  showEmptyGroups: z.boolean(),
  /** Visible properties; fields without a UI yet are kept and shown once they land. */
  properties: z.array(displayPropertySchema).max(DISPLAY_PROPERTIES.length),
})

export type IssueLayout = (typeof ISSUE_LAYOUTS)[number]
export type IssueGrouping = (typeof ISSUE_GROUPINGS)[number]
export type CompletedIssues = (typeof COMPLETED_ISSUE_WINDOWS)[number]
export type DisplayProperty = (typeof DISPLAY_PROPERTIES)[number]
export type DisplayOptions = z.infer<typeof displayOptionsSchema>
