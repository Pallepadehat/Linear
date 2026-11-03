import { z } from 'zod'
import { nameSchema, teamKeySchema, workspaceScopedSchema } from './common'

export const statusCategorySchema = z.enum([
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
])

export const workflowStatusSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: statusCategorySchema,
  position: z.number().int(),
})

export const teamSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  key: z.string(),
})

/** docs/domain.md → Estimates. `off` hides estimates for the team. */
export const estimateScaleSchema = z.enum(['off', 'linear', 'fibonacci', 'exponential', 'tshirt'])

/** 0 No priority … 4 Low; same scale as issue priority (docs/domain.md → Priorities). */
const defaultPrioritySchema = z.number().int().min(0).max(4)

export const teamWithStatusesSchema = teamSchema.extend({
  statuses: z.array(workflowStatusSchema),
  /** The status new issues get when none is given; already resolved through the fallback rule. */
  defaultStatusId: z.uuid().nullable(),
  defaultPriority: defaultPrioritySchema,
  defaultAssigneeId: z.uuid().nullable(),
  estimateScale: estimateScaleSchema,
  /** Whether 0 is offered on the scale. */
  estimateAllowZero: z.boolean(),
})

export const createTeamInputSchema = workspaceScopedSchema.extend({
  name: nameSchema,
  key: teamKeySchema,
})

export const getTeamInputSchema = workspaceScopedSchema.extend({ key: teamKeySchema })

/** Owner-only. Omitted fields are left unchanged. */
export const updateTeamInputSchema = workspaceScopedSchema.extend({
  key: teamKeySchema,
  defaultStatusId: z.uuid().optional(),
  defaultPriority: defaultPrioritySchema.optional(),
  defaultAssigneeId: z.uuid().nullable().optional(),
  estimateScale: estimateScaleSchema.optional(),
  estimateAllowZero: z.boolean().optional(),
})

export type EstimateScale = z.infer<typeof estimateScaleSchema>
export type StatusCategory = z.infer<typeof statusCategorySchema>
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>
export type Team = z.infer<typeof teamSchema>
export type TeamWithStatuses = z.infer<typeof teamWithStatusesSchema>
export type CreateTeamInput = z.infer<typeof createTeamInputSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamInputSchema>
