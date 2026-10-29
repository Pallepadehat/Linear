import { createWorkspace, listMembers } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { imageUrl } from '../../lib/upload-urls'
import { toTeamDto } from '../teams/teams.dto'
import { toWorkspaceDto } from './workspaces.dto'

export const workspacesRouter = {
  create: authed.workspaces.create.handler(async ({ context, input }) => {
    const { workspace, team } = await createWorkspace(context.db, {
      userId: context.user.id,
      ...input,
    })
    return { workspace: toWorkspaceDto(workspace, 'owner'), team: team ? toTeamDto(team) : null }
  }),

  get: authed.workspaces.get
    .use(requireWorkspace(), (input) => input.workspaceSlug)
    .handler(({ context }) => toWorkspaceDto(context.workspace, context.role)),

  listMembers: authed.workspaces.listMembers
    .use(requireWorkspace(), (input) => input.workspaceSlug)
    .handler(async ({ context }) => {
      const members = await listMembers(context.db, context.workspace.id)
      return Promise.all(
        members.map(async (m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          joinedAt: m.joinedAt,
          avatarUrl: await imageUrl(context.db, context.storage, m.avatarUploadId),
        })),
      )
    }),
}
