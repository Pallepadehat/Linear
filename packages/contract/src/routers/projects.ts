import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  createProjectInputSchema,
  updateProjectInputSchema,
  projectIdInputSchema,
  projectSchema,
  projectDetailSchema,
} from '../schemas/projects'

export const projectsContract = {
  list: oc.input(workspaceScopedSchema).output(z.array(projectSchema)),
  get: oc.input(projectIdInputSchema).output(projectDetailSchema),
  create: oc.input(createProjectInputSchema).output(projectSchema),
  update: oc.input(updateProjectInputSchema).output(projectSchema),
  delete: oc.input(projectIdInputSchema).output(z.object({ id: z.uuid() })),
}
