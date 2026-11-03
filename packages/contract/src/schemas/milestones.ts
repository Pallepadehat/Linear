import { z } from 'zod'
import { nameSchema, workspaceScopedSchema } from './common'
import { projectDateSchema } from './projects'

/** A project's milestone (docs/domain.md → Project milestones). */
export const milestoneSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  targetDate: projectDateSchema.nullable(),
  sortOrder: z.number().int(),
  /** Every issue in the milestone; `doneCount` only those in a `completed` status. */
  issueCount: z.number().int().min(0),
  doneCount: z.number().int().min(0),
  /** `doneCount / issueCount` as a fraction from 0 to 1; 0 without issues. */
  progress: z.number().min(0).max(1),
  /** Has issues and all of them are done. */
  isComplete: z.boolean(),
  createdAt: z.date(),
})

/** The project's current milestone (first not complete), as shown in the projects list. */
export const milestoneSummarySchema = milestoneSchema.pick({
  id: true,
  name: true,
  progress: true,
})

export const listMilestonesInputSchema = workspaceScopedSchema.extend({ projectId: z.uuid() })
export const milestoneIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

const fields = {
  name: nameSchema,
  description: z.string().max(10_000).nullable(),
  targetDate: projectDateSchema.nullable(),
}
export const createMilestoneInputSchema = workspaceScopedSchema.extend({
  projectId: z.uuid(),
  name: fields.name,
  description: fields.description.optional(),
  targetDate: fields.targetDate.optional(),
})
/** Omitted fields are left unchanged. */
export const updateMilestoneInputSchema = milestoneIdInputSchema.extend(
  z.object(fields).partial().shape,
)
/** Ids first, in this order; milestones left out keep their relative order after them. */
export const reorderMilestonesInputSchema = workspaceScopedSchema.extend({
  projectId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1).max(200),
})

export type Milestone = z.infer<typeof milestoneSchema>
export type MilestoneSummary = z.infer<typeof milestoneSummarySchema>
export type UpdateMilestoneInput = z.input<typeof updateMilestoneInputSchema>
