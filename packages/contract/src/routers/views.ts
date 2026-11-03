import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createViewInputSchema,
  listViewsInputSchema,
  updateViewInputSchema,
  viewIdInputSchema,
  viewSchema,
} from '../schemas/views'

export const viewsContract = {
  // Shared views plus the caller's private ones; bounded, so a plain array (AGENTS.md → API).
  list: oc.input(listViewsInputSchema).output(z.array(viewSchema)),
  get: oc.input(viewIdInputSchema).output(viewSchema),
  create: oc.input(createViewInputSchema).output(viewSchema),
  update: oc.input(updateViewInputSchema).output(viewSchema),
  delete: oc.input(viewIdInputSchema).output(z.object({ id: z.uuid() })),
}
