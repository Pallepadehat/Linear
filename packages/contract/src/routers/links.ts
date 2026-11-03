import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createIssueLinkInputSchema,
  createProjectLinkInputSchema,
  listProjectLinksInputSchema,
  projectLinkIdInputSchema,
  projectLinkSchema,
  updateProjectLinkInputSchema,
  issueLinkIdInputSchema,
  issueLinkSchema,
  updateIssueLinkInputSchema,
} from '../schemas/links'

export const issueLinksContract = {
  create: oc.input(createIssueLinkInputSchema).output(issueLinkSchema),
  update: oc.input(updateIssueLinkInputSchema).output(issueLinkSchema),
  delete: oc.input(issueLinkIdInputSchema).output(z.object({ id: z.uuid() })),
}

export const projectLinksContract = {
  /** Plain array in `sortOrder` (bounded: a project's resources). */
  list: oc.input(listProjectLinksInputSchema).output(z.array(projectLinkSchema)),
  create: oc.input(createProjectLinkInputSchema).output(projectLinkSchema),
  update: oc.input(updateProjectLinkInputSchema).output(projectLinkSchema),
  delete: oc.input(projectLinkIdInputSchema).output(z.object({ id: z.uuid() })),
}
