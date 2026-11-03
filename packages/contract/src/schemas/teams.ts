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

/** 0 No priority … 4 Low; same scale as issue priority (docs/domain.md → Priorities). */
const defaultPrioritySchema = z.number().int().min(0).max(4)

/** Cycle settings (docs/domain.md → Cycles); weekday 0 = Sunday. */
export const cycleSettingsSchema = z.object({
  cyclesEnabled: z.boolean(),
  cycleDurationWeeks: z.number().int().min(1).max(8),
  cycleStartWeekday: z.number().int().min(0).max(6),
  cycleCooldownWeeks: z.number().int().min(0).max(2),
  cycleUpcomingCount: z.number().int().min(1).max(6),
  cycleAutoAddStarted: z.boolean(),
  cycleRolloverUnfinished: z.boolean(),
})

export const teamWithStatusesSchema = teamSchema.extend({
  statuses: z.array(workflowStatusSchema),
  /** The status new issues get when none is given; already resolved through the fallback rule. */
  defaultStatusId: z.uuid().nullable(),
  defaultPriority: defaultPrioritySchema,
  defaultAssigneeId: z.uuid().nullable(),
  ...cycleSettingsSchema.shape,
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
  ...cycleSettingsSchema.partial().shape,
})

export type StatusCategory = z.infer<typeof statusCategorySchema>
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>
export type Team = z.infer<typeof teamSchema>
export type CycleSettings = z.infer<typeof cycleSettingsSchema>
export type TeamWithStatuses = z.infer<typeof teamWithStatusesSchema>
export type CreateTeamInput = z.infer<typeof createTeamInputSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamInputSchema>
