import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createTemplateInputSchema,
  issueTemplateSchema,
  listTemplatesInputSchema,
  templateIdInputSchema,
  updateTemplateInputSchema,
} from '../schemas/templates'

export const templatesContract = {
  // Bounded per workspace and team, so a plain array (see AGENTS.md → API).
  list: oc.input(listTemplatesInputSchema).output(z.array(issueTemplateSchema)),
  get: oc.input(templateIdInputSchema).output(issueTemplateSchema),
  create: oc.input(createTemplateInputSchema).output(issueTemplateSchema),
  update: oc.input(updateTemplateInputSchema).output(issueTemplateSchema),
  delete: oc.input(templateIdInputSchema).output(z.object({ id: z.uuid() })),
}
