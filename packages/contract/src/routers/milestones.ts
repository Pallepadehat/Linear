import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createMilestoneInputSchema,
  listMilestonesInputSchema,
  milestoneIdInputSchema,
  milestoneSchema,
  reorderMilestonesInputSchema,
  updateMilestoneInputSchema,
} from '../schemas/milestones'

export const milestonesContract = {
  // Bounded per project, so a plain array in `sortOrder`.
  list: oc.input(listMilestonesInputSchema).output(z.array(milestoneSchema)),
  create: oc.input(createMilestoneInputSchema).output(milestoneSchema),
  update: oc.input(updateMilestoneInputSchema).output(milestoneSchema),
  delete: oc.input(milestoneIdInputSchema).output(z.object({ id: z.uuid() })),
  reorder: oc.input(reorderMilestonesInputSchema).output(z.array(milestoneSchema)),
}
