import {
  createView,
  deleteView,
  getView,
  listViews,
  updateView,
  type ViewActor,
} from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'
import { toViewDto } from './views.dto'

const inWorkspace = requireWorkspace()

const actorOf = (context: {
  workspace: { id: string }
  user: { id: string }
  role: ViewActor['role']
}): ViewActor => ({
  workspaceId: context.workspace.id,
  userId: context.user.id,
  role: context.role,
})

// Any member may create views; core decides who sees and edits them (docs/domain.md → Views).
export const viewsRouter = {
  list: authed.views.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const views = await listViews(context.db, actorOf(context), input.teamId)
      return Promise.all(views.map((view) => toViewDto(context.db, context.storage, view)))
    }),

  get: authed.views.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toViewDto(context.db, context.storage, await getView(context.db, actorOf(context), input.id)),
    ),

  create: authed.views.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, ...fields } = input
      const view = await createView(context.db, actorOf(context), fields)
      await publishChange(context, { type: 'view.updated', viewId: view.id })
      return toViewDto(context.db, context.storage, view)
    }),

  update: authed.views.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, ...fields } = input
      const view = await updateView(context.db, actorOf(context), fields)
      await publishChange(context, { type: 'view.updated', viewId: view.id })
      return toViewDto(context.db, context.storage, view)
    }),

  delete: authed.views.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const deleted = await deleteView(context.db, actorOf(context), input.id)
      await publishChange(context, { type: 'view.deleted', viewId: deleted.id })
      return deleted
    }),
}
