import {
  DomainError,
  signInstallState,
  type GitHubAppClient,
  type GitHubInstallationSummary,
  type GitHubRepositorySummary,
} from '@linear/core'
import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp, TEST_AUTH_SECRET } from './harness'

/** Stands in for GitHub: which installations each OAuth code sees, and each installation's repos. */
const userInstallations = new Map<string, GitHubInstallationSummary[]>()
const installationRepos = new Map<number, GitHubRepositorySummary[]>()
const fakeGitHub: GitHubAppClient = {
  installUrl: (state) =>
    `https://github.com/apps/linear-test/installations/new?state=${encodeURIComponent(state)}`,
  listUserInstallations: async (code) => {
    const installations = userInstallations.get(code)
    if (!installations) throw new DomainError('BAD_REQUEST', 'GitHub authorization expired')
    return installations
  },
  listInstallationRepositories: async (id) => installationRepos.get(id) ?? null,
}

const { app, db } = await setupTestApp({ github: fakeGitHub })
const { app: unconfiguredApp } = await setupTestApp()

const repo = (id: number, fullName: string) => ({ id, fullName })

/** An owner with workspace `slug`, whose GitHub account sees installation `installationId`. */
async function ownerWithInstallation(slug: string, installationId: number, login: string) {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: slug, slug })
  const code = `code-${slug}`
  userInstallations.set(code, [{ id: installationId, accountLogin: login }])
  const { url } = await owner.client.github.installUrl({ workspaceSlug: slug })
  const state = new URL(url).searchParams.get('state')!
  const result = await owner.client.github.completeInstall({ state, installationId, code })
  return { owner, workspace, installation: result.installation, state, code }
}

describe('github integration', () => {
  it('installs, connects and disconnects repositories (happy path)', async () => {
    userInstallations.clear()
    installationRepos.set(1, [repo(500, 'tip/web'), repo(501, 'tip/api')])
    const owner = await signUp(app, 'Owner')
    await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    const github = owner.client.github

    const { url } = await github.installUrl({ workspaceSlug: 'tip' })
    expect(url).toMatch(/^https:\/\/github\.com\/apps\/linear-test\/installations\/new\?state=/)
    const state = new URL(url).searchParams.get('state')!
    userInstallations.set('code-1', [{ id: 1, accountLogin: 'tip' }])

    const completed = await github.completeInstall({ state, installationId: 1, code: 'code-1' })
    expect(completed).toEqual({
      workspaceSlug: 'tip',
      installation: { id: completed.installation.id, accountLogin: 'tip' },
    })
    const installationId = completed.installation.id

    expect(await github.repositories.list({ workspaceSlug: 'tip' })).toEqual({
      configured: true,
      installations: [
        {
          id: installationId,
          accountLogin: 'tip',
          repositories: [
            { githubRepoId: 501, fullName: 'tip/api', repositoryId: null },
            { githubRepoId: 500, fullName: 'tip/web', repositoryId: null },
          ],
        },
      ],
    })

    const connected = await github.repositories.connect({
      workspaceSlug: 'tip',
      installationId,
      githubRepoId: 500,
    })
    expect(connected).toEqual({ id: connected.id, githubRepoId: 500, fullName: 'tip/web' })
    // Connecting twice is a no-op.
    await expect(
      github.repositories.connect({ workspaceSlug: 'tip', installationId, githubRepoId: 500 }),
    ).resolves.toEqual(connected)

    const listed = await github.repositories.list({ workspaceSlug: 'tip' })
    expect(listed.installations[0]!.repositories).toContainEqual({
      githubRepoId: 500,
      fullName: 'tip/web',
      repositoryId: connected.id,
    })

    await expect(
      github.repositories.disconnect({ workspaceSlug: 'tip', id: connected.id }),
    ).resolves.toEqual({ id: connected.id })
    const afterDisconnect = await github.repositories.list({ workspaceSlug: 'tip' })
    expect(afterDisconnect.installations[0]!.repositories.every((r) => !r.repositoryId)).toBe(true)
    await expect(
      github.repositories.disconnect({ workspaceSlug: 'tip', id: connected.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('re-installing the same installation in its workspace is idempotent', async () => {
    const { owner, installation, state, code } = await ownerWithInstallation('tip', 2, 'old')
    userInstallations.set(code, [{ id: 2, accountLogin: 'renamed' }])
    await expect(
      owner.client.github.completeInstall({ state, installationId: 2, code }),
    ).resolves.toEqual({
      workspaceSlug: 'tip',
      installation: { id: installation.id, accountLogin: 'renamed' },
    })
  })

  it('forbids members from every GitHub procedure', async () => {
    installationRepos.set(3, [repo(530, 'tip/web')])
    const { workspace, installation } = await ownerWithInstallation('tip', 3, 'tip')
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const github = member.client.github
    const forbidden = { code: 'FORBIDDEN' }

    await expect(github.installUrl({ workspaceSlug: 'tip' })).rejects.toMatchObject(forbidden)
    await expect(github.repositories.list({ workspaceSlug: 'tip' })).rejects.toMatchObject(
      forbidden,
    )
    await expect(
      github.repositories.connect({
        workspaceSlug: 'tip',
        installationId: installation.id,
        githubRepoId: 530,
      }),
    ).rejects.toMatchObject(forbidden)
    await expect(
      github.repositories.disconnect({ workspaceSlug: 'tip', id: installation.id }),
    ).rejects.toMatchObject(forbidden)

    // Even with a validly signed state of their own, a member can't complete an install.
    userInstallations.set('member-code', [{ id: 3, accountLogin: 'tip' }])
    const memberState = signInstallState(
      { workspaceId: workspace.id, userId: member.userId },
      TEST_AUTH_SECRET,
    )
    await expect(
      github.completeInstall({ state: memberState, installationId: 3, code: 'member-code' }),
    ).rejects.toMatchObject(forbidden)
  })

  it('hides workspaces from non-members and rejects anonymous calls', async () => {
    await ownerWithInstallation('tip', 4, 'tip')
    const stranger = await signUp(app, 'Stranger')

    await expect(
      stranger.client.github.repositories.list({ workspaceSlug: 'tip' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      rpcClient(app).github.repositories.list({ workspaceSlug: 'tip' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns CONFLICT for a repository connected to another workspace', async () => {
    installationRepos.set(5, [repo(550, 'shared/repo')])
    installationRepos.set(6, [repo(550, 'shared/repo')])
    const first = await ownerWithInstallation('first', 5, 'first')
    const second = await ownerWithInstallation('second', 6, 'second')

    await first.owner.client.github.repositories.connect({
      workspaceSlug: 'first',
      installationId: first.installation.id,
      githubRepoId: 550,
    })
    await expect(
      second.owner.client.github.repositories.connect({
        workspaceSlug: 'second',
        installationId: second.installation.id,
        githubRepoId: 550,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('returns CONFLICT for an installation attached to another workspace', async () => {
    await ownerWithInstallation('first', 7, 'org')
    await expect(ownerWithInstallation('second', 7, 'org')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('only attaches installations the GitHub user can access', async () => {
    const owner = await signUp(app, 'Owner')
    await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    const { url } = await owner.client.github.installUrl({ workspaceSlug: 'tip' })
    const state = new URL(url).searchParams.get('state')!
    userInstallations.set('own-code', [{ id: 8, accountLogin: 'mine' }])

    // A guessed installation id the user's GitHub account can't see.
    await expect(
      owner.client.github.completeInstall({ state, installationId: 9, code: 'own-code' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      owner.client.github.completeInstall({ state, installationId: 8, code: 'unknown-code' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rejects a tampered, expired or someone else’s state', async () => {
    const { owner, workspace, state, code } = await ownerWithInstallation('tip', 10, 'tip')
    const other = await signUp(app, 'Other')
    const github = owner.client.github
    const badRequest = { code: 'BAD_REQUEST' }

    await expect(
      github.completeInstall({ state: `${state}x`, installationId: 10, code }),
    ).rejects.toMatchObject(badRequest)
    const expired = signInstallState(
      { workspaceId: workspace.id, userId: owner.userId },
      TEST_AUTH_SECRET,
      Date.now() - 11 * 60 * 1000,
    )
    await expect(
      github.completeInstall({ state: expired, installationId: 10, code }),
    ).rejects.toMatchObject(badRequest)
    // The callback link is bound to the user who started the install.
    await expect(
      other.client.github.completeInstall({ state, installationId: 10, code }),
    ).rejects.toMatchObject(badRequest)
  })

  it('only connects repositories the installation can access', async () => {
    installationRepos.set(11, [repo(611, 'tip/web')])
    installationRepos.set(12, [repo(612, 'other/web')])
    const { owner, installation } = await ownerWithInstallation('tip', 11, 'tip')
    const other = await ownerWithInstallation('other', 12, 'other')
    const github = owner.client.github

    await expect(
      github.repositories.connect({
        workspaceSlug: 'tip',
        installationId: installation.id,
        githubRepoId: 612,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Another workspace's installation is invisible.
    await expect(
      github.repositories.connect({
        workspaceSlug: 'tip',
        installationId: other.installation.id,
        githubRepoId: 612,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('keeps connected repositories listed after the App is uninstalled on GitHub', async () => {
    installationRepos.set(13, [repo(613, 'tip/web')])
    const { owner, installation } = await ownerWithInstallation('tip', 13, 'tip')
    const connected = await owner.client.github.repositories.connect({
      workspaceSlug: 'tip',
      installationId: installation.id,
      githubRepoId: 613,
    })
    installationRepos.delete(13)

    const listed = await owner.client.github.repositories.list({ workspaceSlug: 'tip' })
    expect(listed.installations[0]!.repositories).toEqual([
      { githubRepoId: 613, fullName: 'tip/web', repositoryId: connected.id },
    ])
  })

  it('reports an unconfigured App and refuses to install', async () => {
    const owner = await signUp(unconfiguredApp, 'Owner')
    await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })

    await expect(owner.client.github.repositories.list({ workspaceSlug: 'tip' })).resolves.toEqual({
      configured: false,
      installations: [],
    })
    await expect(owner.client.github.installUrl({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })
})
