import {
  createWorkspace,
  disableInviteCode,
  getInviteCode,
  joinWorkspaceByCode,
  listMembers,
  resetInviteCode,
} from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { imageUrl } from '../../lib/upload-urls'
import { toTeamDto } from '../teams/teams.dto'
import { toWorkspaceDto } from './workspaces.dto'

const asOwner = requireWorkspace('owner')

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

  join: authed.workspaces.join.handler(async ({ context, input }) => {
    const { workspace, role } = await joinWorkspaceByCode(context.db, context.user.id, input.code)
    return toWorkspaceDto(workspace, role)
  }),

  getInvite: authed.workspaces.getInvite
    .use(asOwner, (input) => input.workspaceSlug)
    .handler(async ({ context }) => ({
      code: await getInviteCode(context.db, context.workspace.id),
    })),

  resetInvite: authed.workspaces.resetInvite
    .use(asOwner, (input) => input.workspaceSlug)
    .handler(async ({ context }) => ({
      code: await resetInviteCode(context.db, context.workspace.id),
    })),

  disableInvite: authed.workspaces.disableInvite
    .use(asOwner, (input) => input.workspaceSlug)
    .handler(async ({ context }) => {
      await disableInviteCode(context.db, context.workspace.id)
      return { code: null }
    }),
}
