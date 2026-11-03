import type { ListIssuesInput } from '@linear/contract'
import {
  githubInstallations,
  githubRepositories,
  issuePullRequestLinks,
  issues as issuesTable,
  pullRequests,
} from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

/** TIP-1..TIP-5 in workspace `tip`, created oldest to newest; TIP-3 has a linked PR. */
async function seeded() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const status = (name: string) => team.statuses.find((s) => s.name === name)!
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  const project = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'Launch' })
  const label = (name: string) =>
    owner.client.labels.create({ workspaceSlug: 'tip', name, color: '#eb5757' })
  const [bug, ui] = [await label('Bug'), await label('UI')]
  const create = (client: typeof owner.client, title: string, fields: Record<string, unknown>) =>
    client.issues.create({ workspaceSlug: 'tip', teamId: team.id, title, ...fields })

  const created = [
    await create(owner.client, 'Fix login redirect', {
      priority: 3,
      labelIds: [bug.id],
      description: 'Users bounce to the **dashboard**',
    }),
    await create(member.client, 'Wide header', {
      priority: 1,
      assigneeId: member.userId,
      statusId: status('Todo').id,
    }),
    await create(owner.client, 'Dark mode', { projectId: project.id, labelIds: [ui.id] }),
    await create(member.client, 'Login form polish', {
      priority: 4,
      assigneeId: owner.userId,
      projectId: project.id,
      labelIds: [bug.id, ui.id],
      statusId: status('Done').id,
    }),
    await create(owner.client, 'Onboarding', { priority: 2, statusId: status('Todo').id }),
  ]

  // Spread the creation and update times over the last 30 days: TIP-1 30 days ago … TIP-5 today.
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  for (const [index, issue] of created.entries()) {
    const at = new Date(now - (4 - index) * 7.5 * DAY)
    await db
      .update(issuesTable)
      .set({
        createdAt: at,
        updatedAt: at,
        ...(issue.completedAt && { completedAt: at }),
      })
      .where(eq(issuesTable.id, issue.id))
  }

  await linkPullRequest(workspace.id, created[2]!.id)

  const ids = async (filter: Partial<ListIssuesInput> = {}, client = owner.client) =>
    (await client.issues.list({ workspaceSlug: 'tip', ...filter })).items.map((i) => i.identifier)
  return { owner, member, workspace, team, status, project, bug, ui, created, ids, now, DAY }
}

async function linkPullRequest(workspaceId: string, issueId: string) {
  const [installation] = await db
    .insert(githubInstallations)
    .values({ installationId: 100, workspaceId, accountLogin: 'tip' })
    .returning()
  const [repository] = await db
    .insert(githubRepositories)
    .values({
      githubRepoId: 200,
      workspaceId,
      installationId: installation!.id,
      fullName: 'tip/repo',
    })
    .returning()
  const [pr] = await db
    .insert(pullRequests)
    .values({
      githubPrId: 300,
      repositoryId: repository!.id,
      workspaceId,
      number: 1,
      title: 'Dark mode',
      url: 'https://github.com/tip/repo/pull/1',
      branch: 'tip-3-dark-mode',
      state: 'open',
    })
    .returning()
  await db
    .insert(issuePullRequestLinks)
    .values({ workspaceId, issueId, pullRequestId: pr!.id, type: 'closing' })
}

describe('issues.list filter operators', () => {
  it('excludes values with the `not` variants, keeping issues without a value', async () => {
    const { owner, member, project, bug, ui, status, ids } = await seeded()

    expect(await ids({ statusIdsNot: [status('Todo').id] })).toEqual(['TIP-4', 'TIP-3', 'TIP-1'])
    expect(await ids({ prioritiesNot: [0, 1, 2] })).toEqual(['TIP-4', 'TIP-1'])
    // "Assignee is not Member" keeps unassigned issues; `null` excludes them.
    expect(await ids({ assigneeIdsNot: [member.userId] })).toEqual([
      'TIP-5',
      'TIP-4',
      'TIP-3',
      'TIP-1',
    ])
    expect(await ids({ assigneeIdsNot: [null] })).toEqual(['TIP-4', 'TIP-2'])
    expect(await ids({ assigneeIdsNot: [null, owner.userId] })).toEqual(['TIP-2'])
    expect(await ids({ projectIdsNot: [project.id] })).toEqual(['TIP-5', 'TIP-2', 'TIP-1'])
    expect(await ids({ projectIdsNot: [null] })).toEqual(['TIP-4', 'TIP-3'])
    expect(await ids({ labelIdsNot: [bug.id] })).toEqual(['TIP-5', 'TIP-3', 'TIP-2'])
    expect(await ids({ labelIdsNot: [bug.id, ui.id] })).toEqual(['TIP-5', 'TIP-2'])
    // Combines with the positive list by AND.
    expect(await ids({ labelIds: [ui.id], labelIdsNot: [bug.id] })).toEqual(['TIP-3'])
  })

  it('matches any or all of the labels', async () => {
    const { bug, ui, ids } = await seeded()
    expect(await ids({ labelIds: [bug.id, ui.id] })).toEqual(['TIP-4', 'TIP-3', 'TIP-1'])
    expect(await ids({ labelIds: [bug.id, ui.id], labelMode: 'any' })).toHaveLength(3)
    expect(await ids({ labelIds: [bug.id, ui.id], labelMode: 'all' })).toEqual(['TIP-4'])
    expect(await ids({ labelIds: [bug.id], labelMode: 'all' })).toEqual(['TIP-4', 'TIP-1'])
  })

  it('filters by creator, with `me` as the signed-in user', async () => {
    const { owner, member, ids } = await seeded()
    expect(await ids({ creatorIds: [member.userId] })).toEqual(['TIP-4', 'TIP-2'])
    expect(await ids({ creatorIds: ['me'] })).toEqual(['TIP-5', 'TIP-3', 'TIP-1'])
    expect(await ids({ creatorIds: ['me'] }, member.client)).toEqual(['TIP-4', 'TIP-2'])
    expect(await ids({ creatorIdsNot: ['me'] })).toEqual(['TIP-4', 'TIP-2'])
    expect(await ids({ creatorIds: [owner.userId, member.userId] })).toHaveLength(5)
    expect(await ids({ creatorIds: [crypto.randomUUID()] })).toEqual([])
  })

  it('filters by created, updated and completed date ranges', async () => {
    const { ids, now, DAY } = await seeded()
    const ago = (days: number) => new Date(now - days * DAY)

    // TIP-n was created and updated (4 - n + 1) * 7.5 days ago.
    expect(await ids({ createdAfter: ago(8) })).toEqual(['TIP-5', 'TIP-4'])
    expect(await ids({ createdBefore: ago(8) })).toEqual(['TIP-3', 'TIP-2', 'TIP-1'])
    expect(await ids({ createdAfter: ago(20), createdBefore: ago(5) })).toEqual(['TIP-4', 'TIP-3'])
    expect(await ids({ updatedAfter: ago(1) })).toEqual(['TIP-5'])
    expect(await ids({ updatedBefore: ago(29) })).toEqual(['TIP-1'])
    // `…After` is inclusive.
    expect(await ids({ createdAfter: ago(7.5) })).toEqual(['TIP-5', 'TIP-4'])
    // Only completed issues have a completion date (TIP-4, 7.5 days ago).
    expect(await ids({ completedSince: ago(30) })).toEqual(['TIP-4'])
    expect(await ids({ completedBefore: new Date(now + DAY) })).toEqual(['TIP-4'])
    expect(await ids({ completedSince: ago(1) })).toEqual([])
    // The display option's `completedAfter` keeps open issues; `completedSince` doesn't.
    expect(await ids({ completedAfter: ago(30) })).toHaveLength(5)
  })

  it('searches title and description content', async () => {
    const { ids } = await seeded()
    expect(await ids({ content: 'login' })).toEqual(['TIP-4', 'TIP-1'])
    expect(await ids({ content: 'DASHBOARD' })).toEqual(['TIP-1'])
    // LIKE wildcards are literal.
    expect(await ids({ content: '%' })).toEqual([])
    expect(await ids({ content: '  ' })).toHaveLength(5)
  })

  it('filters by linked pull requests', async () => {
    const { ids } = await seeded()
    expect(await ids({ hasPullRequests: true })).toEqual(['TIP-3'])
    expect(await ids({ hasPullRequests: false })).toEqual(['TIP-5', 'TIP-4', 'TIP-2', 'TIP-1'])
  })

  it('applies the new filters to facets too', async () => {
    const { owner, bug, ui } = await seeded()
    const facets = await owner.client.issues.facets({
      workspaceSlug: 'tip',
      labelIds: [bug.id, ui.id],
      labelMode: 'all',
      creatorIdsNot: ['me'],
    })
    expect(facets.priorities).toEqual([{ value: 4, count: 1 }])
    expect(
      (await owner.client.issues.facets({ workspaceSlug: 'tip', content: 'login' })).priorities,
    ).toHaveLength(2)
  })

  it("doesn't leak another workspace's issues through any filter", async () => {
    const { member, bug, owner } = await seeded()
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    await stranger.client.teams.create({ workspaceSlug: 'mine', name: 'Mine', key: 'MIN' })

    await expect(
      stranger.client.issues.list({ workspaceSlug: 'tip', creatorIds: [owner.userId] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.issues.facets({ workspaceSlug: 'tip', hasPullRequests: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // In their own workspace, `tip`'s ids match nothing and exclusions leak nothing.
    const mine = (filter: Partial<ListIssuesInput>) =>
      stranger.client.issues.list({ workspaceSlug: 'mine', ...filter }).then((page) => page.items)
    expect(await mine({ creatorIds: [member.userId] })).toEqual([])
    expect(await mine({ labelIdsNot: [bug.id] })).toEqual([])
    expect(await mine({ content: 'login' })).toEqual([])
    expect(await mine({ hasPullRequests: true })).toEqual([])
    expect(await mine({ hasPullRequests: false })).toEqual([])
    await expect(
      rpcClient(app).issues.list({ workspaceSlug: 'tip', content: 'login' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects malformed filter values', async () => {
    const { owner } = await seeded()
    const list = (filter: Record<string, unknown>) =>
      owner.client.issues.list({ workspaceSlug: 'tip', ...filter } as Partial<ListIssuesInput> & {
        workspaceSlug: string
      })
    await expect(list({ labelMode: 'some' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(list({ creatorIds: ['you'] })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(list({ content: 'x'.repeat(256) })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })
})
