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

export const teamWithStatusesSchema = teamSchema.extend({
  statuses: z.array(workflowStatusSchema),
})

export const createTeamInputSchema = workspaceScopedSchema.extend({
  name: nameSchema,
  key: teamKeySchema,
})

export const getTeamInputSchema = workspaceScopedSchema.extend({ key: teamKeySchema })

export type StatusCategory = z.infer<typeof statusCategorySchema>
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>
export type Team = z.infer<typeof teamSchema>
export type TeamWithStatuses = z.infer<typeof teamWithStatusesSchema>
export type CreateTeamInput = z.infer<typeof createTeamInputSchema>
