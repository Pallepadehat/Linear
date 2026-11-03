import { z } from 'zod'
import { workspaceScopedSchema } from './common'
import { pullRequestStateSchema } from './github'
import { labelSchema } from './labels'
import { issueLinkSchema } from './links'
import { issueRelationsSchema } from './relations'
import { statusCategorySchema, workflowStatusSchema } from './teams'

/** 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low (docs/domain.md → Priorities). */
export const issuePrioritySchema = z.number().int().min(0).max(4)

/**
 * Points on the team's estimate scale (docs/domain.md → Estimates); `null` = no
 * estimate. The server checks the value against the scale.
 */
export const issueEstimateSchema = z.number().int().min(0).max(100)
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

/** The issue's project as its row shows it; the icon URL comes from the projects list. */
export const issueProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  iconUploadId: z.uuid().nullable(),
})

/** The issue's milestone as its row chip shows it. */
export const issueMilestoneSchema = z.object({ id: z.uuid(), name: z.string() })

/** A linked PR as its row chip shows it; the full PR comes from `github.pullRequests`. */
export const issuePullRequestChipSchema = z.object({
  number: z.number().int().positive(),
  state: pullRequestStateSchema,
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
  project: issueProjectSchema.nullable(),
  /** Always a milestone of `projectId` (docs/domain.md → Project milestones). */
  milestoneId: z.uuid().nullable(),
  milestone: issueMilestoneSchema.nullable(),
  cycleId: z.uuid().nullable(),
  estimate: issueEstimateSchema.nullable(),
  dueDate: issueDueDateSchema,
  labels: z.array(labelSchema),
  /** Linked PRs: open and draft first, then merged, then closed; newest first within each. */
  pullRequests: z.array(issuePullRequestChipSchema),
  /** Web links on the issue (linked PRs are counted by `pullRequests`). */
  linkCount: z.number().int().min(0),
  /** Whether the signed-in user is subscribed (docs/domain.md → Subscribers). */
  isSubscribed: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  /** Open (not completed or canceled) issues blocking this one / blocked by it. */
  blockedByCount: z.number().int().min(0),
  blockingCount: z.number().int().min(0),
  parentId: z.uuid().nullable(),
  /**
   * Null without sub-issues. `done` counts completed-category sub-issues; canceled
   * ones are left out of `total`.
   */
  subIssueProgress: z
    .object({ done: z.number().int().min(0), total: z.number().int().min(0) })
    .nullable(),
})

/**
 * `issues.get` / `getByIdentifier`: the issue with its parent, sub-issues (oldest first)
 * and relations.
 */
export const issueDetailSchema = issueSchema.extend({
  parent: z
    .object({
      id: z.uuid(),
      identifier: z.string(),
      title: z.string(),
      status: workflowStatusSchema,
    })
    .nullable(),
  children: z.array(issueSchema),
  relations: issueRelationsSchema,
  /** Web links, oldest first (linked PRs come from `github.pullRequests.listForIssue`). */
  links: z.array(issueLinkSchema),
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
  /** A milestone of `projectId`, else `BAD_REQUEST`. */
  milestoneId: z.uuid().nullable().optional(),
  /** An open cycle of the issue's team. */
  cycleId: z.uuid().nullable().optional(),
  estimate: issueEstimateSchema.nullable().optional(),
  labelIds: labelIdsSchema.optional(),
  /** Creates it as a sub-issue (parent in the same workspace, any team). */
  parentId: z.uuid().nullable().optional(),
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
  /** Changing or clearing the project also clears the milestone, unless one is given. */
  projectId: z.uuid().nullable().optional(),
  /** A milestone of the issue's (new) project, else `BAD_REQUEST`. */
  milestoneId: z.uuid().nullable().optional(),
  /** An open cycle of the issue's team. */
  cycleId: z.uuid().nullable().optional(),
  estimate: issueEstimateSchema.nullable().optional(),
  labelIds: labelIdsSchema.optional(),
  /** `null` removes the parent. A cycle or the issue itself is `BAD_REQUEST`. */
  parentId: z.uuid().nullable().optional(),
  dueDate: issueDueDateSchema.optional(),
})

export const issueIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

/** Bulk actions take at most this many issues per call (docs/domain.md → Bulk actions). */
export const BULK_ISSUE_LIMIT = 250
const bulkIssueIdsSchema = z.array(z.uuid()).min(1).max(BULK_ISSUE_LIMIT)

/**
 * The properties a bulk update can set on every selected issue. Omitted fields are
 * left unchanged; labels are added and removed per issue instead of replaced.
 */
export const bulkIssuePatchSchema = z
  .object({
    statusId: z.uuid().optional(),
    priority: issuePrioritySchema.optional(),
    assigneeId: z.uuid().nullable().optional(),
    projectId: z.uuid().nullable().optional(),
    addLabelIds: labelIdsSchema.optional(),
    removeLabelIds: labelIdsSchema.optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'Change at least one property',
  })

export const bulkUpdateIssuesInputSchema = workspaceScopedSchema.extend({
  ids: bulkIssueIdsSchema,
  patch: bulkIssuePatchSchema,
})

export const bulkDeleteIssuesInputSchema = workspaceScopedSchema.extend({ ids: bulkIssueIdsSchema })

export const bulkUpdateIssuesOutputSchema = z.object({ items: z.array(issueSchema) })
export const bulkDeleteIssuesOutputSchema = z.object({ ids: z.array(z.uuid()) })

export const getIssueByIdentifierInputSchema = workspaceScopedSchema.extend({
  identifier: issueIdentifierSchema,
})

export const issueSortSchema = z.enum(['createdAt', 'updatedAt', 'priority', 'estimate', 'dueDate'])
/**
 * `desc` = newest / most urgent / largest / latest due first. No priority, no
 * estimate and no due date always sort last.
 */
export const sortDirectionSchema = z.enum(['asc', 'desc'])

/**
 * `overdue`: before today and not completed or canceled. `dueThisWeek`: today through
 * Sunday. `noDueDate`: unset.
 */
export const issueDueFilterSchema = z.enum(['overdue', 'dueThisWeek', 'noDueDate'])

const filterIdsSchema = z.array(z.uuid()).max(100)
/** `null` in the list matches issues with no value (unassigned / no project / no cycle). */
const nullableFilterIdsSchema = z.array(z.uuid().nullable()).max(100)
/** `'me'` stands for the signed-in user, so a shared URL means the viewer. */
const userFilterIdsSchema = z.array(z.union([z.uuid(), z.literal('me')])).max(100)

/** Labels filter: issues with any of `labelIds`, or with all of them. */
export const labelFilterModeSchema = z.enum(['any', 'all'])

/**
 * The issue list's scope and filters, shared by `issues.list` and `issues.facets`;
 * add new list filters here so every consumer gets them.
 * Filters combine with AND; values within one filter with OR (labels: any of, or all
 * of with `labelMode: 'all'`). An empty list doesn't filter. `…Not` lists exclude
 * issues with any of the values; on a nullable property an excluded value still
 * keeps issues without one (assignee is not Ada keeps unassigned issues), and `null`
 * excludes issues without one. Date bounds: `…After` is inclusive, `…Before` exclusive.
 */
export const issueFiltersSchema = workspaceScopedSchema.extend({
  /** Scope from the page (team / project view), not a user filter. */
  teamId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  milestoneId: z.uuid().optional(),
  cycleId: z.uuid().optional(),
  /** `'me'` narrows to issues assigned to the signed-in user (My Issues). */
  assignee: z.literal('me').optional(),
  /** `'me'` narrows to issues the signed-in user created. */
  creator: z.literal('me').optional(),
  statusIds: filterIdsSchema.optional(),
  /** Status categories (the Active / Backlog tabs); combines with `statusIds` via AND. */
  statusCategories: z.array(statusCategorySchema).max(5).optional(),
  /**
   * Completed and canceled issues only when they finished at or after this time
   * (display options → Completed issues); open issues are unaffected.
   */
  completedAfter: z.date().optional(),
  priorities: z.array(issuePrioritySchema).max(5).optional(),
  assigneeIds: nullableFilterIdsSchema.optional(),
  projectIds: nullableFilterIdsSchema.optional(),
  milestoneIds: nullableFilterIdsSchema.optional(),
  cycleIds: nullableFilterIdsSchema.optional(),
  labelIds: filterIdsSchema.optional(),
  labelMode: labelFilterModeSchema.default('any'),
  statusIdsNot: filterIdsSchema.optional(),
  prioritiesNot: z.array(issuePrioritySchema).max(5).optional(),
  assigneeIdsNot: nullableFilterIdsSchema.optional(),
  projectIdsNot: nullableFilterIdsSchema.optional(),
  labelIdsNot: filterIdsSchema.optional(),
  /** Created by any of these users. */
  creatorIds: userFilterIdsSchema.optional(),
  creatorIdsNot: userFilterIdsSchema.optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  updatedAfter: z.date().optional(),
  updatedBefore: z.date().optional(),
  /**
   * Completion date bounds (Completed date filter). Only finished issues have one, so
   * either bound leaves out open issues, unlike `completedAfter` above.
   */
  completedSince: z.date().optional(),
  completedBefore: z.date().optional(),
  /** Title or description contains (case-insensitive). */
  content: z.string().trim().max(255).optional(),
  /** `true`: has a linked pull request; `false`: has none. */
  hasPullRequests: z.boolean().optional(),
  /** Estimate values; `null` matches issues without an estimate, `'any'` those with one. */
  estimates: z
    .array(z.union([issueEstimateSchema, z.literal('any')]).nullable())
    .max(20)
    .optional(),
  /** Any of these due date buckets; `overdue` and `dueThisWeek` need `today`. */
  due: z.array(issueDueFilterSchema).max(3).optional(),
  /** The viewer's local date, so relative due filters never guess a timezone. */
  today: isoDateSchema.optional(),
  /** Any of these users is subscribed. */
  subscriberIds: userFilterIdsSchema.optional(),
  /** `true`: has a web link or a linked PR; `false`: has neither (docs/domain.md → Links). */
  hasLinks: z.boolean().optional(),
  /** Title contains (case-insensitive), or an exact identifier like `tip-12`. */
  q: z.string().trim().max(255).optional(),
  /** `false` leaves out sub-issues (issues with a parent). */
  showSubIssues: z.boolean().default(true),
  /** Leaves out this issue and its descendants (choosing a parent without making a cycle). */
  excludeSubtreeOf: z.uuid().optional(),
})

export const listIssuesInputSchema = issueFiltersSchema.extend({
  sort: issueSortSchema.default('createdAt'),
  direction: sortDirectionSchema.default('desc'),
  /** `nextCursor` from the previous page. */
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(100).default(50),
})

/** Subscribes `userId` (default: the signed-in user); any member may add or remove others. */
export const issueSubscriptionInputSchema = workspaceScopedSchema.extend({
  issueId: z.uuid(),
  userId: z.uuid().optional(),
})

export const issueSubscriptionSchema = z.object({ subscribed: z.boolean() })

export const issueSubscribersInputSchema = workspaceScopedSchema.extend({ issueId: z.uuid() })

export const issuePageSchema = z.object({
  items: z.array(issueSchema),
  nextCursor: z.string().nullable(),
})

/** What the Details panel counts: exactly the list's scope and filters, no paging or sort. */
export const issueFacetsInputSchema = issueFiltersSchema

const facetCountSchema = z.number().int().nonnegative()

/** Issue counts per value; `id: null` = no assignee / no project. Sorted by count, descending. */
export const issueFacetsSchema = z.object({
  assignees: z.array(z.object({ id: z.uuid().nullable(), count: facetCountSchema })),
  labels: z.array(z.object({ id: z.uuid(), count: facetCountSchema })),
  priorities: z.array(z.object({ value: issuePrioritySchema, count: facetCountSchema })),
  projects: z.array(z.object({ id: z.uuid().nullable(), count: facetCountSchema })),
})

export type IssuePriority = z.infer<typeof issuePrioritySchema>
export type Issue = z.infer<typeof issueSchema>
export type IssueProject = z.infer<typeof issueProjectSchema>
export type IssueMilestone = z.infer<typeof issueMilestoneSchema>
export type IssuePullRequestChip = z.infer<typeof issuePullRequestChipSchema>
export type IssueDetail = z.infer<typeof issueDetailSchema>
export type SubIssueProgress = NonNullable<Issue['subIssueProgress']>
export type IssuePage = z.infer<typeof issuePageSchema>
export type CreateIssueInput = z.input<typeof createIssueInputSchema>
export type UpdateIssueInput = z.input<typeof updateIssueInputSchema>
export type BulkIssuePatch = z.input<typeof bulkIssuePatchSchema>
export type BulkUpdateIssuesInput = z.input<typeof bulkUpdateIssuesInputSchema>
export type ListIssuesInput = z.input<typeof listIssuesInputSchema>
export type IssueFiltersInput = z.input<typeof issueFiltersSchema>
export type IssueFacetsInput = z.input<typeof issueFacetsInputSchema>
export type IssueFacets = z.infer<typeof issueFacetsSchema>
export type IssueSubscriptionInput = z.input<typeof issueSubscriptionInputSchema>
export type IssueSort = z.infer<typeof issueSortSchema>
export type SortDirection = z.infer<typeof sortDirectionSchema>
export type LabelFilterMode = z.infer<typeof labelFilterModeSchema>
export type IssueDueFilter = z.infer<typeof issueDueFilterSchema>
