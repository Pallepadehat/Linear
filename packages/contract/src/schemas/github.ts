import { z } from 'zod'
import { workspaceScopedSchema } from './common'

// GitHub ids are numeric and fit in a JS number (Drizzle maps them with mode 'number').
const githubIdSchema = z.number().int().positive()

export const githubInstallUrlSchema = z.object({ url: z.url() })

export const completeGithubInstallInputSchema = z.object({
  /** The signed state from `installUrl`; it names the workspace. */
  state: z.string().min(1),
  installationId: githubIdSchema,
  /** OAuth code GitHub adds to the callback when user authorization is on. */
  code: z.string().min(1),
})

export const githubInstallationSchema = z.object({
  id: z.uuid(),
  accountLogin: z.string(),
})

export const completeGithubInstallOutputSchema = z.object({
  workspaceSlug: z.string(),
  installation: githubInstallationSchema,
})

export const githubAvailableRepositorySchema = z.object({
  githubRepoId: githubIdSchema,
  fullName: z.string(),
  /** Connection id; null when the repository is not connected. */
  repositoryId: z.uuid().nullable(),
})

export const githubRepositoriesSchema = z.object({
  /** False when the server has no GitHub App settings; installs and connects are disabled. */
  configured: z.boolean(),
  installations: z.array(
    githubInstallationSchema.extend({ repositories: z.array(githubAvailableRepositorySchema) }),
  ),
})

export const connectGithubRepositoryInputSchema = workspaceScopedSchema.extend({
  installationId: z.uuid(),
  githubRepoId: githubIdSchema,
})

export const githubRepositorySchema = z.object({
  id: z.uuid(),
  githubRepoId: githubIdSchema,
  fullName: z.string(),
})

export const disconnectGithubRepositoryInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export const pullRequestStateSchema = z.enum(['open', 'draft', 'merged', 'closed'])
/** `closing` PRs complete the issue when merged; `reference` PRs only link (docs/domain.md). */
export const pullRequestLinkTypeSchema = z.enum(['closing', 'reference'])

/** A PR as linked to one issue. Shared by issue detail, issue rows and the links list. */
export const linkedPullRequestSchema = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  title: z.string(),
  url: z.url(),
  repoFullName: z.string(),
  state: pullRequestStateSchema,
  linkType: pullRequestLinkTypeSchema,
  updatedAt: z.date(),
})

export const listIssuePullRequestsInputSchema = workspaceScopedSchema.extend({
  issueId: z.uuid(),
})

export type GithubInstallation = z.infer<typeof githubInstallationSchema>
export type GithubAvailableRepository = z.infer<typeof githubAvailableRepositorySchema>
export type GithubRepositories = z.infer<typeof githubRepositoriesSchema>
export type GithubRepository = z.infer<typeof githubRepositorySchema>
export type PullRequestState = z.infer<typeof pullRequestStateSchema>
export type PullRequestLinkType = z.infer<typeof pullRequestLinkTypeSchema>
export type LinkedPullRequest = z.infer<typeof linkedPullRequestSchema>
export type ListIssuePullRequestsInput = z.input<typeof listIssuePullRequestsInputSchema>
export type CompleteGithubInstallInput = z.infer<typeof completeGithubInstallInputSchema>
