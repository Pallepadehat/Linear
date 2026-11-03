import {
  githubInstallations,
  githubRepositories,
  issuePullRequestLinks,
  pullRequests,
} from '@linear/db'
import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

let nextGithubId = 1000

async function issueWithRepo() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const issue = await owner.client.issues.create({
    workspaceSlug: 'tip',
    teamId: team.id,
    title: 'Fix login',
  })
  const [installation] = await db
    .insert(githubInstallations)
    .values({ workspaceId: workspace.id, installationId: nextGithubId++, accountLogin: 'tip' })
    .returning()
  const [repository] = await db
    .insert(githubRepositories)
    .values({
      workspaceId: workspace.id,
      installationId: installation!.id,
      githubRepoId: nextGithubId++,
      fullName: 'tip/app',
    })
    .returning()

  /** A PR in `tip/app` linked to the issue. */
  async function link(
    number: number,
    state: 'open' | 'draft' | 'merged' | 'closed',
    type: 'closing' | 'reference',
    updatedAt: Date,
  ) {
    const [pr] = await db
      .insert(pullRequests)
      .values({
        workspaceId: workspace.id,
        repositoryId: repository!.id,
        githubPrId: nextGithubId++,
        number,
        title: `PR ${number}`,
        url: `https://github.com/tip/app/pull/${number}`,
        branch: `tip-${issue.number}-pr-${number}`,
        state,
        createdAt: updatedAt,
        updatedAt,
      })
      .returning()
    await db
      .insert(issuePullRequestLinks)
      .values({ workspaceId: workspace.id, issueId: issue.id, pullRequestId: pr!.id, type })
    return pr!
  }

  const list = () =>
    owner.client.github.pullRequests.listForIssue({ workspaceSlug: 'tip', issueId: issue.id })
  return { owner, workspace, team, issue, link, list }
}

describe('github.pullRequests.listForIssue', () => {
  it('is empty for an issue without linked PRs', async () => {
    const { list } = await issueWithRepo()
    expect(await list()).toEqual([])
  })

  it('returns each linked PR with its state and link type, newest first', async () => {
    const { workspace, issue, link, list } = await issueWithRepo()
    const merged = await link(1, 'merged', 'closing', new Date('2026-11-01T10:00:00Z'))
    const closed = await link(2, 'closed', 'closing', new Date('2026-11-01T11:00:00Z'))
    const draft = await link(3, 'draft', 'reference', new Date('2026-11-01T12:00:00Z'))
    const open = await link(4, 'open', 'reference', new Date('2026-11-01T13:00:00Z'))
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)

    const expected = [open, draft, closed, merged].map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      repoFullName: 'tip/app',
      state: pr.state,
      linkType: pr === open || pr === draft ? 'reference' : 'closing',
      updatedAt: pr.updatedAt,
    }))
    expect(await list()).toEqual(expected)
    // Any member can read it, not only the owner.
    expect(
      await member.client.github.pullRequests.listForIssue({
        workspaceSlug: 'tip',
        issueId: issue.id,
      }),
    ).toEqual(expected)
  })

  it('only lists PRs linked to that issue', async () => {
    const { owner, team, link, list } = await issueWithRepo()
    await link(1, 'open', 'closing', new Date())
    const other = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Other',
    })

    expect(await list()).toHaveLength(1)
    expect(
      await owner.client.github.pullRequests.listForIssue({
        workspaceSlug: 'tip',
        issueId: other.id,
      }),
    ).toEqual([])
  })

  it('hides linked PRs from non-members and other workspaces', async () => {
    const { issue, link } = await issueWithRepo()
    await link(1, 'open', 'closing', new Date())
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const notFound = { code: 'NOT_FOUND' }
    const input = (workspaceSlug: string) => ({ workspaceSlug, issueId: issue.id })

    await expect(
      rpcClient(app).github.pullRequests.listForIssue(input('tip')),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      stranger.client.github.pullRequests.listForIssue(input('tip')),
    ).rejects.toMatchObject(notFound)
    await expect(
      stranger.client.github.pullRequests.listForIssue(input('mine')),
    ).rejects.toMatchObject(notFound)
  })
})
