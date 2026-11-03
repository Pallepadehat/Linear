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

async function tipWithIssue() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const issue = await owner.client.issues.create({
    workspaceSlug: 'tip',
    teamId: team.id,
    title: 'Fix login',
  })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  return { owner, member, workspace, team, issue }
}

async function outsiderWorkspace() {
  const outsider = await signUp(app, 'Outsider')
  await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
  const team = await outsider.client.teams.create({
    workspaceSlug: 'other',
    name: 'Other',
    key: 'OTH',
  })
  const issue = await outsider.client.issues.create({
    workspaceSlug: 'other',
    teamId: team.id,
    title: 'Theirs',
  })
  return { outsider, issue }
}

describe('issue links', () => {
  it('creates, lists, updates and deletes a link', async () => {
    const { member, issue } = await tipWithIssue()
    const link = await member.client.issueLinks.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      url: 'https://www.figma.com/file/abc',
      title: '  Mockups ',
    })
    expect(link).toEqual({
      id: expect.any(String),
      url: 'https://www.figma.com/file/abc',
      title: 'Mockups',
      hostname: 'figma.com',
      createdAt: expect.any(Date),
    })
    const detail = await member.client.issues.getByIdentifier({
      workspaceSlug: 'tip',
      identifier: issue.identifier,
    })
    expect(detail.links).toEqual([link])

    const renamed = await member.client.issueLinks.update({
      workspaceSlug: 'tip',
      id: link.id,
      url: 'https://docs.example.dev/spec',
      title: 'Spec',
    })
    expect(renamed).toMatchObject({
      url: 'https://docs.example.dev/spec',
      title: 'Spec',
      hostname: 'docs.example.dev',
    })

    expect(await member.client.issueLinks.delete({ workspaceSlug: 'tip', id: link.id })).toEqual({
      id: link.id,
    })
    expect((await member.client.issues.get({ workspaceSlug: 'tip', id: issue.id })).links).toEqual(
      [],
    )
    await expect(
      member.client.issueLinks.delete({ workspaceSlug: 'tip', id: link.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('defaults the title to the hostname, also after an edit clears it', async () => {
    const { owner, issue } = await tipWithIssue()
    const link = await owner.client.issueLinks.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      url: 'https://www.github.com/tip/app',
    })
    expect(link.title).toBe('github.com')

    // A default title follows the URL; a custom one is kept.
    const moved = await owner.client.issueLinks.update({
      workspaceSlug: 'tip',
      id: link.id,
      url: 'https://gitlab.com/tip/app',
    })
    expect(moved.title).toBe('gitlab.com')
    await owner.client.issueLinks.update({ workspaceSlug: 'tip', id: link.id, title: 'Repo' })
    const kept = await owner.client.issueLinks.update({
      workspaceSlug: 'tip',
      id: link.id,
      url: 'https://example.com/repo',
    })
    expect(kept.title).toBe('Repo')
    const cleared = await owner.client.issueLinks.update({
      workspaceSlug: 'tip',
      id: link.id,
      title: '',
    })
    expect(cleared.title).toBe('example.com')
  })

  it.each(['javascript:alert(1)', 'ftp://example.com/file', 'data:text/html,hi', 'example.com'])(
    'rejects %s with BAD_REQUEST',
    async (url) => {
      const { owner, issue } = await tipWithIssue()
      await expect(
        owner.client.issueLinks.create({ workspaceSlug: 'tip', issueId: issue.id, url }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      const link = await owner.client.issueLinks.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        url: 'https://example.com',
      })
      await expect(
        owner.client.issueLinks.update({ workspaceSlug: 'tip', id: link.id, url }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    },
  )

  it('rejects over-long urls and titles', async () => {
    const { owner, issue } = await tipWithIssue()
    const input = { workspaceSlug: 'tip', issueId: issue.id }
    await expect(
      owner.client.issueLinks.create({ ...input, url: `https://x.dev/${'a'.repeat(2048)}` }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      owner.client.issueLinks.create({ ...input, url: 'https://x.dev', title: 'a'.repeat(256) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('logs added and removed links', async () => {
    const { owner, member, issue } = await tipWithIssue()
    const link = await member.client.issueLinks.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      url: 'https://example.com/a',
      title: 'Spec',
    })
    await owner.client.issueLinks.delete({ workspaceSlug: 'tip', id: link.id })
    const { items } = await owner.client.activity.list({ workspaceSlug: 'tip', issueId: issue.id })
    expect(items.filter((item) => item.kind === 'link')).toEqual([
      expect.objectContaining({
        actorId: member.userId,
        from: null,
        to: ['Spec', 'https://example.com/a'],
      }),
      expect.objectContaining({
        actorId: owner.userId,
        from: ['Spec', 'https://example.com/a'],
        to: null,
      }),
    ])
  })

  it('returns NOT_FOUND across workspaces', async () => {
    const { owner, issue } = await tipWithIssue()
    const { outsider, issue: foreign } = await outsiderWorkspace()

    // An issue in another workspace, through the caller's own workspace.
    await expect(
      owner.client.issueLinks.create({
        workspaceSlug: 'tip',
        issueId: foreign.id,
        url: 'https://example.com',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // A workspace the caller isn't a member of.
    await expect(
      outsider.client.issueLinks.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        url: 'https://example.com',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // A link in another workspace, through the caller's own workspace.
    const link = await owner.client.issueLinks.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      url: 'https://example.com',
    })
    await expect(
      outsider.client.issueLinks.update({ workspaceSlug: 'other', id: link.id, title: 'Mine' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      outsider.client.issueLinks.delete({ workspaceSlug: 'other', id: link.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const detail = await owner.client.issues.get({ workspaceSlug: 'tip', id: issue.id })
    expect(detail.links).toEqual([link])
  })

  it('filters issues by hasLinks (web links and linked PRs)', async () => {
    const { owner, workspace, team, issue: withLink } = await tipWithIssue()
    const create = (title: string) =>
      owner.client.issues.create({ workspaceSlug: 'tip', teamId: team.id, title })
    const withPr = await create('Has PR')
    const plain = await create('Plain')
    await owner.client.issueLinks.create({
      workspaceSlug: 'tip',
      issueId: withLink.id,
      url: 'https://example.com',
    })
    const [installation] = await db
      .insert(githubInstallations)
      .values({ workspaceId: workspace.id, installationId: 9001, accountLogin: 'tip' })
      .returning()
    const [repository] = await db
      .insert(githubRepositories)
      .values({
        workspaceId: workspace.id,
        installationId: installation!.id,
        githubRepoId: 9002,
        fullName: 'tip/app',
      })
      .returning()
    const [pr] = await db
      .insert(pullRequests)
      .values({
        workspaceId: workspace.id,
        repositoryId: repository!.id,
        githubPrId: 9003,
        number: 7,
        title: 'Fix',
        url: 'https://github.com/tip/app/pull/7',
        branch: 'tip-2-fix',
        state: 'open',
      })
      .returning()
    await db
      .insert(issuePullRequestLinks)
      .values({
        workspaceId: workspace.id,
        issueId: withPr.id,
        pullRequestId: pr!.id,
        type: 'closing',
      })

    const ids = async (hasLinks: boolean) =>
      (await owner.client.issues.list({ workspaceSlug: 'tip', hasLinks })).items
        .map((i) => i.id)
        .sort()
    expect(await ids(true)).toEqual([withLink.id, withPr.id].sort())
    expect(await ids(false)).toEqual([plain.id])
  })

  it('requires a session', async () => {
    const { issue } = await tipWithIssue()
    await expect(
      rpcClient(app).issueLinks.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        url: 'https://example.com',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
