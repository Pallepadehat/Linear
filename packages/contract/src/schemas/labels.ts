import { z } from 'zod'
import { nameSchema, workspaceScopedSchema } from './common'

export const labelColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, { message: 'Use a hex color like #5e6ad2' })

export const labelSchema = z.object({
  id: z.uuid(),
  /** Null = workspace label; otherwise the team that owns it. */
  teamId: z.uuid().nullable(),
  name: z.string(),
  color: z.string(),
})

export const listLabelsInputSchema = workspaceScopedSchema.extend({
  /** Workspace labels plus this team's; omitted = every label in the workspace. */
  teamId: z.uuid().optional(),
})

export const createLabelInputSchema = workspaceScopedSchema.extend({
  /** Null or omitted creates a workspace label. */
  teamId: z.uuid().nullable().optional(),
  name: nameSchema,
  color: labelColorSchema,
})

export const updateLabelInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  name: nameSchema.optional(),
  color: labelColorSchema.optional(),
})

export const labelIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export type Label = z.infer<typeof labelSchema>
export type ListLabelsInput = z.infer<typeof listLabelsInputSchema>
export type CreateLabelInput = z.infer<typeof createLabelInputSchema>
export type UpdateLabelInput = z.infer<typeof updateLabelInputSchema>
