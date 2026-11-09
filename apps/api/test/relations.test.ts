import type { IssueRelationType } from '@linear/contract'
import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function tipWithIssues(titles = ['Login', 'Signup', 'Billing']) {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const issues = []
  for (const title of titles) {
    issues.push(await owner.client.issues.create({ workspaceSlug: 'tip', teamId: team.id, title }))
  }
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  return {
    owner,
    member,
    workspace,
    team,
    issues: issues as [(typeof issues)[0], ...typeof issues],
  }
}

// The duplicate's status changes, so statuses are checked in their own test.
const summary = (issue: { id: string; identifier: string; title: string }, relationId: string) => ({
  relationId,
  id: issue.id,
  identifier: issue.identifier,
  title: issue.title,
  status: expect.any(Object),
})

describe('issue relations', () => {
  it.each<[IssueRelationType, string, string]>([
    ['blocks', 'blocks', 'blockedBy'],
    ['related', 'related', 'related'],
    ['duplicate', 'duplicateOf', 'duplicates'],
  ])('reads %s from both sides', async (type, sourceSide, targetSide) => {
    const { member, issues } = await tipWithIssues()
    const [a, b] = issues
    const relation = await member.client.issueRelations.create({
      workspaceSlug: 'tip',
      issueId: a.id,
      relatedIssueId: b!.id,
      type,
    })
    expect(relation).toEqual({ id: expect.any(String), issueId: a.id, relatedIssueId: b!.id, type })

    const source = await member.client.issues.get({ workspaceSlug: 'tip', id: a.id })
    const target = await member.client.issues.getByIdentifier({
      workspaceSlug: 'tip',
      identifier: b!.identifier,
    })
    expect(source.relations[sourceSide as keyof typeof source.relations]).toEqual([
      summary(b!, relation.id),
    ])
    expect(target.relations[targetSide as keyof typeof target.relations]).toEqual([
      summary(a, relation.id),
    ])
    const total = (r: typeof source.relations) => Object.values(r).flat().length
    expect([total(source.relations), total(target.relations)]).toEqual([1, 1])
  })

  it('cancels the duplicate and logs it on both issues', async () => {
    const { owner, issues, team } = await tipWithIssues()
    const [a, b] = issues
    await owner.client.issueRelations.create({
      workspaceSlug: 'tip',
      issueId: a.id,
      relatedIssueId: b!.id,
      type: 'duplicate',
    })

    const duplicate = await owner.client.issues.get({ workspaceSlug: 'tip', id: a.id })
    const canceled = team.statuses.find((s) => s.category === 'canceled')!
    expect(duplicate.status.id).toBe(canceled.id)
    expect(duplicate.completedAt).toBeNull()
    // The original keeps its status.
    const original = await owner.client.issues.get({ workspaceSlug: 'tip', id: b!.id })
    expect(original.status.id).toBe(b!.status.id)

    const activity = async (issueId: string) =>
      (await owner.client.activity.list({ workspaceSlug: 'tip', issueId })).items
    expect(await activity(a.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'relation',
          to: ['duplicate_of', b!.id, b!.identifier],
        }),
        expect.objectContaining({ kind: 'status', from: a.status.id, to: canceled.id }),
      ]),
    )
    expect(await activity(b!.id)).toContainEqual(
      expect.objectContaining({ kind: 'relation', to: ['duplicated_by', a.id, a.identifier] }),
    )
  })

  it('counts open blockers and blocked issues on list rows', async () => {
    const { owner, issues, team } = await tipWithIssues()
    const [a, b, c] = issues
    for (const blocked of [b!, c!]) {
      await owner.client.issueRelations.create({
        workspaceSlug: 'tip',
        issueId: a.id,
        relatedIssueId: blocked.id,
        type: 'blocks',
      })
    }
    const counts = async () => {
      const { items } = await owner.client.issues.list({ workspaceSlug: 'tip' })
      return Object.fromEntries(
        items.map((i) => [i.title, [i.blockedByCount, i.blockingCount] as const]),
      )
    }
    expect(await counts()).toEqual({ Login: [0, 2], Signup: [1, 0], Billing: [1, 0] })

    // A completed issue no longer blocks, and a completed blocked issue isn't counted.
    const done = team.statuses.find((s) => s.category === 'completed')!
    await owner.client.issues.update({ workspaceSlug: 'tip', id: c!.id, statusId: done.id })
    expect(await counts()).toEqual({ Login: [0, 1], Signup: [1, 0], Billing: [1, 0] })
    await owner.client.issues.update({ workspaceSlug: 'tip', id: a.id, statusId: done.id })
    expect(await counts()).toEqual({ Login: [0, 1], Signup: [0, 0], Billing: [0, 0] })
  })

  it('rejects a self-relation', async () => {
    const { owner, issues } = await tipWithIssues()
    await expect(
      owner.client.issueRelations.create({
        workspaceSlug: 'tip',
        issueId: issues[0].id,
        relatedIssueId: issues[0].id,
        type: 'blocks',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it.each<IssueRelationType>(['blocks', 'related', 'duplicate'])(
    'rejects a repeated or reversed %s relation',
    async (type) => {
      const { owner, issues } = await tipWithIssues()
      const [a, b] = issues
      const relate = (issueId: string, relatedIssueId: string) =>
        owner.client.issueRelations.create({ workspaceSlug: 'tip', issueId, relatedIssueId, type })
      await relate(a.id, b!.id)
      await expect(relate(a.id, b!.id)).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(relate(b!.id, a.id)).rejects.toMatchObject({ code: 'CONFLICT' })
    },
  )

  it('allows different relation types between the same issues', async () => {
    const { owner, issues } = await tipWithIssues()
    const [a, b] = issues
    for (const type of ['blocks', 'related'] as const) {
      await owner.client.issueRelations.create({
        workspaceSlug: 'tip',
        issueId: a.id,
        relatedIssueId: b!.id,
        type,
      })
    }
    const { relations } = await owner.client.issues.get({ workspaceSlug: 'tip', id: b!.id })
    expect([relations.blockedBy.length, relations.related.length]).toEqual([1, 1])
  })

  it('returns NOT_FOUND for an issue in another workspace', async () => {
    const { owner, issues } = await tipWithIssues()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
    const team = await outsider.client.teams.create({
      workspaceSlug: 'other',
      name: 'Other',
      key: 'OTH',
    })
    const foreign = await outsider.client.issues.create({
      workspaceSlug: 'other',
      teamId: team.id,
      title: 'Theirs',
    })

    await expect(
      owner.client.issueRelations.create({
        workspaceSlug: 'tip',
        issueId: issues[0].id,
        relatedIssueId: foreign.id,
        type: 'related',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Nor can the outsider reach the workspace or its relations.
    await expect(
      outsider.client.issueRelations.create({
        workspaceSlug: 'tip',
        issueId: issues[0].id,
        relatedIssueId: issues[1]!.id,
        type: 'related',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const relation = await owner.client.issueRelations.create({
      workspaceSlug: 'tip',
      issueId: issues[0].id,
      relatedIssueId: issues[1]!.id,
      type: 'related',
    })
    await expect(
      outsider.client.issueRelations.delete({ workspaceSlug: 'other', id: relation.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('removes a relation from both sides and logs it', async () => {
    const { owner, member, issues } = await tipWithIssues()
    const [a, b] = issues
    const relation = await owner.client.issueRelations.create({
      workspaceSlug: 'tip',
      issueId: a.id,
      relatedIssueId: b!.id,
      type: 'blocks',
    })

    expect(
      await member.client.issueRelations.delete({ workspaceSlug: 'tip', id: relation.id }),
    ).toEqual({ id: relation.id })

    for (const id of [a.id, b!.id]) {
      const issue = await owner.client.issues.get({ workspaceSlug: 'tip', id })
      expect(Object.values(issue.relations).flat()).toEqual([])
    }
    const { items } = await owner.client.activity.list({ workspaceSlug: 'tip', issueId: b!.id })
    expect(items.at(-1)).toMatchObject({
      kind: 'relation',
      actorId: member.userId,
      from: ['blocked_by', a.id, a.identifier],
      to: null,
    })
    await expect(
      owner.client.issueRelations.delete({ workspaceSlug: 'tip', id: relation.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('requires a session', async () => {
    const { issues } = await tipWithIssues()
    await expect(
      rpcClient(app).issueRelations.create({
        workspaceSlug: 'tip',
        issueId: issues[0].id,
        relatedIssueId: issues[1]!.id,
        type: 'related',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
