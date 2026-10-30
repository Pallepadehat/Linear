import { githubInstallations, githubRepositories, type DbOrTx } from '@linear/db'
import { and, asc, eq } from 'drizzle-orm'
import { DomainError } from '../errors'
import type { GitHubAppClient } from './client'

export type CompleteInstallationInput = {
  workspaceId: string
  installationId: number
  /** OAuth code from the install callback; proves the user can see the installation. */
  code: string
}

export type ConnectRepositoryInput = {
  workspaceId: string
  /** Our installation row id, not GitHub's. */
  installationId: string
  githubRepoId: number
}

/**
 * Attaches a GitHub installation to the workspace. Signed `state` alone only says which
 * workspace started the flow; the installation id comes back as a plain query param,
 * so we check it against the installations the authorizing user can actually access.
 */
export async function completeInstallation(
  db: DbOrTx,
  github: GitHubAppClient,
  input: CompleteInstallationInput,
) {
  const visible = await github.listUserInstallations(input.code)
  const match = visible.find((installation) => installation.id === input.installationId)
  if (!match) {
    throw new DomainError('FORBIDDEN', "Your GitHub account can't access that installation")
  }

  // Re-installing refreshes the account login; a row owned by another workspace is left
  // alone, so nothing comes back and that is the conflict.
  const [installation] = await db
    .insert(githubInstallations)
    .values({
      workspaceId: input.workspaceId,
      installationId: match.id,
      accountLogin: match.accountLogin,
    })
    .onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: { accountLogin: match.accountLogin, updatedAt: new Date() },
      setWhere: eq(githubInstallations.workspaceId, input.workspaceId),
    })
    .returning()
  if (!installation) {
    throw new DomainError('CONFLICT', 'That GitHub account is connected to another workspace')
  }
  return installation
}

/**
 * Installations with every repository they can access, marked with the connection id
 * when connected. Connected repositories GitHub no longer reports (App uninstalled,
 * access revoked, or no client configured) are still listed so they can be disconnected.
 */
export async function listRepositories(
  db: DbOrTx,
  github: GitHubAppClient | null,
  workspaceId: string,
) {
  const [installations, connected] = await Promise.all([
    db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.workspaceId, workspaceId))
      .orderBy(asc(githubInstallations.accountLogin)),
    db.select().from(githubRepositories).where(eq(githubRepositories.workspaceId, workspaceId)),
  ])

  return Promise.all(
    installations.map(async (installation) => {
      const available = github
        ? await github.listInstallationRepositories(installation.installationId)
        : null
      const repositories = new Map<
        number,
        { githubRepoId: number; fullName: string; repositoryId: string | null }
      >()
      for (const repo of available ?? []) {
        repositories.set(repo.id, {
          githubRepoId: repo.id,
          fullName: repo.fullName,
          repositoryId: null,
        })
      }
      for (const repo of connected) {
        if (repo.installationId !== installation.id) continue
        repositories.set(repo.githubRepoId, {
          githubRepoId: repo.githubRepoId,
          fullName: repositories.get(repo.githubRepoId)?.fullName ?? repo.fullName,
          repositoryId: repo.id,
        })
      }
      return {
        id: installation.id,
        accountLogin: installation.accountLogin,
        repositories: [...repositories.values()].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        ),
      }
    }),
  )
}

/** Idempotent within a workspace; a repository connected elsewhere is a conflict. */
export async function connectRepository(
  db: DbOrTx,
  github: GitHubAppClient,
  input: ConnectRepositoryInput,
) {
  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(
      and(
        eq(githubInstallations.workspaceId, input.workspaceId),
        eq(githubInstallations.id, input.installationId),
      ),
    )
  if (!installation) throw new DomainError('NOT_FOUND', 'Installation not found')

  // Only repositories the installation can access; otherwise any repo id could be claimed.
  const available = await github.listInstallationRepositories(installation.installationId)
  const repo = available?.find((candidate) => candidate.id === input.githubRepoId)
  if (!repo) throw new DomainError('NOT_FOUND', 'Repository not found in that installation')

  const [repository] = await db
    .insert(githubRepositories)
    .values({
      workspaceId: input.workspaceId,
      installationId: installation.id,
      githubRepoId: repo.id,
      fullName: repo.fullName,
    })
    .onConflictDoUpdate({
      target: githubRepositories.githubRepoId,
      set: { installationId: installation.id, fullName: repo.fullName, updatedAt: new Date() },
      setWhere: eq(githubRepositories.workspaceId, input.workspaceId),
    })
    .returning()
  if (!repository) {
    throw new DomainError('CONFLICT', `${repo.fullName} is connected to another workspace`)
  }
  return repository
}

/** Also removes the repository's pull requests and issue links (FK cascade). */
export async function disconnectRepository(db: DbOrTx, workspaceId: string, id: string) {
  const [repository] = await db
    .delete(githubRepositories)
    .where(and(eq(githubRepositories.workspaceId, workspaceId), eq(githubRepositories.id, id)))
    .returning({ id: githubRepositories.id })
  if (!repository) throw new DomainError('NOT_FOUND', 'Repository not found')
  return repository
}
