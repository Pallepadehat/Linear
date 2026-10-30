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

export type GithubInstallation = z.infer<typeof githubInstallationSchema>
export type GithubAvailableRepository = z.infer<typeof githubAvailableRepositorySchema>
export type GithubRepositories = z.infer<typeof githubRepositoriesSchema>
export type GithubRepository = z.infer<typeof githubRepositorySchema>
export type CompleteGithubInstallInput = z.infer<typeof completeGithubInstallInputSchema>
