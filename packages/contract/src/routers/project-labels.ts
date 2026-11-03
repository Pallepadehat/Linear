import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import { createProjectLabelInputSchema, projectLabelSchema } from '../schemas/projects'

export const projectLabelsContract = {
  // Bounded per workspace, so a plain array (see AGENTS.md → API).
  list: oc.input(workspaceScopedSchema).output(z.array(projectLabelSchema)),
  create: oc.input(createProjectLabelInputSchema).output(projectLabelSchema),
}
