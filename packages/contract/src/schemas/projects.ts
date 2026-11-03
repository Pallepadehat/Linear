import { z } from 'zod'
import { nameSchema, workspaceScopedSchema } from './common'
import { issuePrioritySchema } from './issues'
import { labelColorSchema } from './labels'

export const projectStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'canceled'])
/** A calendar day, `YYYY-MM-DD` (day resolution only; docs/domain.md → Projects). */
export const projectDateSchema = z.iso.date()
export const projectSummarySchema = z
  .string()
  .trim()
  .max(255, { message: 'Keep the summary under 255 characters' })
const fields = {
  name: nameSchema,
  description: z.string().nullable(),
  /** One line under the name on the project page; empty is stored as null. */
  summary: projectSummarySchema.nullable(),
  status: projectStatusSchema,
  iconUploadId: z.uuid().nullable(),
  teamIds: z.array(z.uuid()),
  /** Same scale as issues: 0 No priority, 1 Urgent … 4 Low. */
  priority: issuePrioritySchema,
  leadId: z.uuid().nullable(),
  memberIds: z.array(z.uuid()),
  startDate: projectDateSchema.nullable(),
  targetDate: projectDateSchema.nullable(),
  labelIds: z.array(z.uuid()),
}
export const projectProgressSchema = z.object({
  completed: z.number().int(),
  total: z.number().int(),
})
export const projectSchema = z.object({
  id: z.uuid(),
  ...fields,
  /** Short-lived presigned URL for the icon, or null when there is none (or it is still processing). */
  iconUrl: z.url().nullable(),
  progress: projectProgressSchema,
  /** All issues linked to the project (the same number as `progress.total`). */
  issueCount: z.number().int(),
  /** The first milestone, in order, that isn't complete; null when there is none. */
  currentMilestone: z
    .object({ id: z.uuid(), name: z.string(), progress: z.number().min(0).max(1) })
    .nullable(),
  createdAt: z.date(),
})
export const projectIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })
export const createProjectInputSchema = workspaceScopedSchema.extend({
  ...z.object(fields).partial().shape,
  name: fields.name,
})
export const updateProjectInputSchema = projectIdInputSchema.extend(
  z.object(fields).partial().shape,
)

// Project labels are their own workspace-wide set, separate from issue labels.
export const projectLabelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
})
export const createProjectLabelInputSchema = workspaceScopedSchema.extend({
  name: nameSchema,
  color: labelColorSchema,
})

export type ProjectStatus = z.infer<typeof projectStatusSchema>
export type Project = z.infer<typeof projectSchema>
export type UpdateProjectInput = z.input<typeof updateProjectInputSchema>
export type ProjectProgress = z.infer<typeof projectProgressSchema>
export type ProjectLabel = z.infer<typeof projectLabelSchema>
