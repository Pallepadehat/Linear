import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createIssueRelationInputSchema,
  issueRelationIdInputSchema,
  issueRelationSchema,
} from '../schemas/relations'

export const issueRelationsContract = {
  create: oc.input(createIssueRelationInputSchema).output(issueRelationSchema),
  delete: oc.input(issueRelationIdInputSchema).output(z.object({ id: z.uuid() })),
}
