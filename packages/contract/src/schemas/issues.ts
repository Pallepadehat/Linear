import { z } from 'zod'
import { workspaceScopedSchema } from './common'
import { labelSchema } from './labels'
import { workflowStatusSchema } from './teams'

/** 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low (docs/domain.md → Priorities). */
export const issuePrioritySchema = z.number().int().min(0).max(4)

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
  /** Defaults to the team's `Todo` status. */
  statusId: z.uuid().optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  labelIds: labelIdsSchema.optional(),
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
})

export const issueIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export const getIssueByIdentifierInputSchema = workspaceScopedSchema.extend({
  identifier: issueIdentifierSchema,
})

export const listIssuesInputSchema = workspaceScopedSchema.extend({
  teamId: z.uuid().optional(),
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
