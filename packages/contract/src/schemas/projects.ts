import { z } from 'zod'
import { nameSchema, workspaceScopedSchema } from './common'

export const projectStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'canceled'])
const fields = {
  name: nameSchema,
  description: z.string().nullable(),
  status: projectStatusSchema,
  iconUploadId: z.uuid().nullable(),
  teamIds: z.array(z.uuid()),
}
export const projectSchema = z.object({ id: z.uuid(), ...fields })
export const projectDetailSchema = projectSchema.extend({
  progress: z.object({ completed: z.number().int(), total: z.number().int() }),
})
export const projectIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })
export const createProjectInputSchema = workspaceScopedSchema.extend({
  ...fields,
  description: fields.description.optional(),
  status: fields.status.optional(),
  iconUploadId: fields.iconUploadId.optional(),
  teamIds: fields.teamIds.optional(),
})
export const updateProjectInputSchema = projectIdInputSchema.extend(
  z.object(fields).partial().shape,
)
export type Project = z.infer<typeof projectSchema>
