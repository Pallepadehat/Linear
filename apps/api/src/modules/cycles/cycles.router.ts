import { getCycle, listCycles, updateCycle } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { toCycleDetailDto, toCycleDto } from './cycles.dto'

const inWorkspace = requireWorkspace()

// Any member may view and rename cycles; scheduling follows the team settings (owner-only).
export const cyclesRouter = {
  list: authed.cycles.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      (await listCycles(context.db, context.workspace.id, input.teamId)).map(toCycleDto),
    ),

  get: authed.cycles.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toCycleDetailDto(await getCycle(context.db, context.workspace.id, input.id)),
    ),

  update: authed.cycles.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toCycleDetailDto(
        await updateCycle(context.db, {
          workspaceId: context.workspace.id,
          id: input.id,
          name: input.name,
        }),
      ),
    ),
}
