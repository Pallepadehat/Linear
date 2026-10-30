import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  createLabelInputSchema,
  labelIdInputSchema,
  labelSchema,
  updateLabelInputSchema,
} from '../schemas/labels'

export const labelsContract = {
  // Bounded per workspace, so a plain array (see AGENTS.md → API).
  list: oc.input(workspaceScopedSchema).output(z.array(labelSchema)),
  create: oc.input(createLabelInputSchema).output(labelSchema),
  update: oc.input(updateLabelInputSchema).output(labelSchema),
  delete: oc.input(labelIdInputSchema).output(z.object({ id: z.uuid() })),
}
