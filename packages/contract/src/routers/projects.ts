import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  listProjectActivityInputSchema,
  projectActivityPageSchema,
} from '../schemas/project-activity'
import {
  createProjectInputSchema,
  updateProjectInputSchema,
  projectIdInputSchema,
  projectProgressInputSchema,
  projectProgressReportSchema,
  projectSchema,
} from '../schemas/projects'

export const projectsContract = {
  list: oc.input(workspaceScopedSchema).output(z.array(projectSchema)),
  get: oc.input(projectIdInputSchema).output(projectSchema),
  create: oc.input(createProjectInputSchema).output(projectSchema),
  update: oc.input(updateProjectInputSchema).output(projectSchema),
  delete: oc.input(projectIdInputSchema).output(z.object({ id: z.uuid() })),
  // Unbounded, so cursor-paginated, newest first (see AGENTS.md → API).
  activity: oc.input(listProjectActivityInputSchema).output(projectActivityPageSchema),
  /** The Progress card: daily scope / started / completed and per-assignee / label counts. */
  progress: oc.input(projectProgressInputSchema).output(projectProgressReportSchema),
}
