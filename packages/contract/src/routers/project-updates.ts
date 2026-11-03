import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createProjectUpdateInputSchema,
  listProjectUpdatesInputSchema,
  projectUpdateIdInputSchema,
  projectUpdateSchema,
  projectUpdatesPageSchema,
  updateProjectUpdateInputSchema,
} from '../schemas/project-updates'

export const projectUpdatesContract = {
  // Unbounded, so cursor-paginated, newest first (see AGENTS.md → API).
  list: oc.input(listProjectUpdatesInputSchema).output(projectUpdatesPageSchema),
  // Any member; the new update sets the project's health.
  create: oc.input(createProjectUpdateInputSchema).output(projectUpdateSchema),
  // Author only.
  update: oc.input(updateProjectUpdateInputSchema).output(projectUpdateSchema),
  // Author, or a workspace owner (docs/domain.md → Roles).
  delete: oc.input(projectUpdateIdInputSchema).output(z.object({ id: z.uuid() })),
}
