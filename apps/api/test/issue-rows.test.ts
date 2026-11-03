import {
  githubInstallations,
  githubRepositories,
  issuePullRequestLinks,
  pullRequests,
} from '@linear/db'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

let nextGithubId = 5000

// The row chips (docs/domain.md → Issue rows): project, linked PRs and web link count.
async function tip() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const create = (title: string, projectId?: string) =>
    owner.client.issues.create({ workspaceSlug: 'tip', teamId: team.id, title, projectId })
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

  async function linkPr(
    issueId: string,
    number: number,
    state: 'open' | 'draft' | 'merged' | 'closed',
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
        branch: `pr-${number}`,
        state,
      })
      .returning()
    await db
      .insert(issuePullRequestLinks)
      .values({ workspaceId: workspace.id, issueId, pullRequestId: pr!.id, type: 'reference' })
  }
  return { owner, team, create, linkPr }
}

describe('issue row fields', () => {
  it('returns project, pull requests (open first) and link count on list and get', async () => {
    const { owner, team, create, linkPr } = await tip()
    const project = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'Launch' })
    const withAll = await create('With everything', project.id)
    const bare = await create('Bare')
    await linkPr(withAll.id, 3, 'merged')
    await linkPr(withAll.id, 4, 'closed')
    await linkPr(withAll.id, 5, 'open')
    await linkPr(withAll.id, 7, 'draft')
    await linkPr(withAll.id, 9, 'merged')
    for (const url of ['https://figma.com/a', 'https://notion.so/b']) {
      await owner.client.issueLinks.create({ workspaceSlug: 'tip', issueId: withAll.id, url })
    }

    const { items } = await owner.client.issues.list({ workspaceSlug: 'tip', teamId: team.id })
    const row = items.find((item) => item.id === withAll.id)!
    expect(row.project).toEqual({ id: project.id, name: 'Launch', iconUploadId: null })
    expect(row.pullRequests).toEqual([
      { number: 5, state: 'open' },
      { number: 7, state: 'draft' },
      { number: 9, state: 'merged' },
      { number: 3, state: 'merged' },
      { number: 4, state: 'closed' },
    ])
    expect(row.linkCount).toBe(2)
    expect(items.find((item) => item.id === bare.id)).toMatchObject({
      project: null,
      pullRequests: [],
      linkCount: 0,
    })

    const detail = await owner.client.issues.get({ workspaceSlug: 'tip', id: withAll.id })
    expect(detail).toMatchObject({
      project: row.project,
      pullRequests: row.pullRequests,
      linkCount: 2,
    })

    // Moving it out of the project clears the chip in the update response.
    const updated = await owner.client.issues.update({
      workspaceSlug: 'tip',
      id: withAll.id,
      projectId: null,
    })
    expect(updated.project).toBeNull()
  })

  it("never shows another workspace's issues, projects or PRs", async () => {
    const { owner, team, create, linkPr } = await tip()
    const project = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'Secret' })
    const issue = await create('Secret issue', project.id)
    await linkPr(issue.id, 1, 'open')

    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const notFound = { code: 'NOT_FOUND' }
    await expect(
      stranger.client.issues.list({ workspaceSlug: 'tip', teamId: team.id }),
    ).rejects.toMatchObject(notFound)
    await expect(
      stranger.client.issues.get({ workspaceSlug: 'mine', id: issue.id }),
    ).rejects.toMatchObject(notFound)
    // In their own workspace, Tip's team scope and their unscoped list match nothing.
    for (const teamId of [team.id, undefined]) {
      const { items } = await stranger.client.issues.list({ workspaceSlug: 'mine', teamId })
      expect(items).toEqual([])
    }
  })
})
