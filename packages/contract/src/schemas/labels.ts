import { z } from 'zod'
import { nameSchema, workspaceScopedSchema } from './common'

export const labelColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, { message: 'Use a hex color like #5e6ad2' })

export const labelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
})

export const createLabelInputSchema = workspaceScopedSchema.extend({
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
export type CreateLabelInput = z.infer<typeof createLabelInputSchema>
export type UpdateLabelInput = z.infer<typeof updateLabelInputSchema>
