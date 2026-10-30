import { listActivity } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { toActivityDto } from './activity.dto'

const inWorkspace = requireWorkspace()

export const activityRouter = {
  list: authed.activity.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const page = await listActivity(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        cursor: input.cursor,
        limit: input.limit,
      })
      return { items: page.items.map(toActivityDto), nextCursor: page.nextCursor }
    }),
}
