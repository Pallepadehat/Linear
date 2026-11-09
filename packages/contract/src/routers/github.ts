import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  completeGithubInstallInputSchema,
  completeGithubInstallOutputSchema,
  connectGithubRepositoryInputSchema,
  disconnectGithubRepositoryInputSchema,
  githubInstallUrlSchema,
  githubRepositoriesSchema,
  githubRepositorySchema,
  linkedPullRequestSchema,
  listIssuePullRequestsInputSchema,
} from '../schemas/github'

// Owner-only, except reading an issue's pull requests (docs/domain.md → Roles).
export const githubContract = {
  installUrl: oc.input(workspaceScopedSchema).output(githubInstallUrlSchema),
  completeInstall: oc
    .input(completeGithubInstallInputSchema)
    .output(completeGithubInstallOutputSchema),
  repositories: {
    // Bounded by what the workspace's installations can access, so a plain structure.
    list: oc.input(workspaceScopedSchema).output(githubRepositoriesSchema),
    connect: oc.input(connectGithubRepositoryInputSchema).output(githubRepositorySchema),
    disconnect: oc.input(disconnectGithubRepositoryInputSchema).output(z.object({ id: z.uuid() })),
  },
  pullRequests: {
    // An issue links to a handful of PRs, so a plain array (see AGENTS.md → API).
    listForIssue: oc
      .input(listIssuePullRequestsInputSchema)
      .output(z.array(linkedPullRequestSchema)),
  },
}
