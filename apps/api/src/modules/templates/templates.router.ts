import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'
import { toTemplateDto } from './templates.dto'

const inWorkspace = requireWorkspace()

// Any member may manage templates, like labels (docs/domain.md → Templates).
export const templatesRouter = {
  list: authed.templates.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const templates = await listTemplates(context.db, context.workspace.id, input.teamId)
      return templates.map(toTemplateDto)
    }),

  get: authed.templates.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toTemplateDto(await getTemplate(context.db, context.workspace.id, input.id)),
    ),

  create: authed.templates.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, ...fields } = input
      const template = await createTemplate(context.db, {
        ...fields,
        workspaceId: context.workspace.id,
        createdById: context.user.id,
      })
      await publishChange(context, { type: 'template.updated', templateId: template.id })
      return toTemplateDto(template)
    }),

  update: authed.templates.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, ...fields } = input
      const template = await updateTemplate(context.db, {
        ...fields,
        workspaceId: context.workspace.id,
      })
      await publishChange(context, { type: 'template.updated', templateId: template.id })
      return toTemplateDto(template)
    }),

  delete: authed.templates.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const deleted = await deleteTemplate(context.db, context.workspace.id, input.id)
      await publishChange(context, { type: 'template.updated', templateId: deleted.id })
      return deleted
    }),
}
