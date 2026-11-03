import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createIssueLinkInputSchema,
  issueLinkIdInputSchema,
  issueLinkSchema,
  updateIssueLinkInputSchema,
} from '../schemas/links'

export const issueLinksContract = {
  create: oc.input(createIssueLinkInputSchema).output(issueLinkSchema),
  update: oc.input(updateIssueLinkInputSchema).output(issueLinkSchema),
  delete: oc.input(issueLinkIdInputSchema).output(z.object({ id: z.uuid() })),
}
