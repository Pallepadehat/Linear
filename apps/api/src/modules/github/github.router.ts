import {
  completeInstallation,
  connectRepository,
  disconnectRepository,
  listRepositories,
  signInstallState,
  verifyInstallState,
} from '@linear/core'
import { ORPCError } from '@orpc/server'
import { authed } from '../../orpc/base'
import type { InitialContext } from '../../orpc/context'
import { requireWorkspace, resolveWorkspaceById } from '../../orpc/middleware/require-workspace'
import { toGithubInstallationDto, toGithubRepositoryDto } from './github.dto'

// Connecting GitHub is owner-only (docs/domain.md → Roles).
const asOwner = requireWorkspace('owner')

function requireGitHub(context: InitialContext) {
  if (!context.github) {
    throw new ORPCError('BAD_REQUEST', { message: 'The GitHub App is not configured' })
  }
  return context.github
}

export const githubRouter = {
  installUrl: authed.github.installUrl
    .use(asOwner, (input) => input.workspaceSlug)
    .handler(({ context }) => {
      const github = requireGitHub(context)
      const state = signInstallState(
        { workspaceId: context.workspace.id, userId: context.user.id },
        context.installStateSecret,
      )
      return { url: github.installUrl(state) }
    }),

  completeInstall: authed.github.completeInstall.handler(async ({ context, input }) => {
    const github = requireGitHub(context)
    const state = verifyInstallState(input.state, context.installStateSecret)
    // Bound to the user who started the install, so a callback link can't be replayed by someone else.
    if (!state || state.userId !== context.user.id) {
      throw new ORPCError('BAD_REQUEST', { message: 'The install link expired. Try again.' })
    }
    const { workspace } = await resolveWorkspaceById(
      context.db,
      state.workspaceId,
      context.user.id,
      'owner',
    )
    const installation = await completeInstallation(context.db, github, {
      workspaceId: workspace.id,
      installationId: input.installationId,
      code: input.code,
    })
    return { workspaceSlug: workspace.slug, installation: toGithubInstallationDto(installation) }
  }),

  repositories: {
    list: authed.github.repositories.list
      .use(asOwner, (input) => input.workspaceSlug)
      .handler(async ({ context }) => ({
        configured: context.github !== null,
        installations: await listRepositories(context.db, context.github, context.workspace.id),
      })),

    connect: authed.github.repositories.connect
      .use(asOwner, (input) => input.workspaceSlug)
      .handler(async ({ context, input }) => {
        const repository = await connectRepository(context.db, requireGitHub(context), {
          workspaceId: context.workspace.id,
          installationId: input.installationId,
          githubRepoId: input.githubRepoId,
        })
        return toGithubRepositoryDto(repository)
      }),

    disconnect: authed.github.repositories.disconnect
      .use(asOwner, (input) => input.workspaceSlug)
      .handler(({ context, input }) =>
        disconnectRepository(context.db, context.workspace.id, input.id),
      ),
  },
}
