import type { GithubInstallation, GithubRepository } from '@linear/contract'
import type { githubInstallations, githubRepositories } from '@linear/db'

export function toGithubInstallationDto(
  row: typeof githubInstallations.$inferSelect,
): GithubInstallation {
  return { id: row.id, accountLogin: row.accountLogin }
}

export function toGithubRepositoryDto(
  row: typeof githubRepositories.$inferSelect,
): GithubRepository {
  return { id: row.id, githubRepoId: row.githubRepoId, fullName: row.fullName }
}
