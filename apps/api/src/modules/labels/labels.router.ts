import { createLabel, deleteLabel, listLabels, updateLabel } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { toLabelDto } from './labels.dto'

const inWorkspace = requireWorkspace()

// Any member may manage labels (docs/domain.md → Roles).
export const labelsRouter = {
  list: authed.labels.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const labels = await listLabels(context.db, context.workspace.id, input.teamId)
      return labels.map(toLabelDto)
    }),

  create: authed.labels.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const label = await createLabel(context.db, {
        workspaceId: context.workspace.id,
        teamId: input.teamId,
        name: input.name,
        color: input.color,
      })
      return toLabelDto(label)
    }),

  update: authed.labels.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const label = await updateLabel(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        name: input.name,
        color: input.color,
      })
      return toLabelDto(label)
    }),

  delete: authed.labels.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => deleteLabel(context.db, context.workspace.id, input.id)),
}
