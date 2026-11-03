import { activityLog, issues as issuesTable } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function workspaceWithIssues(count = 3) {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const status = (name: string) => team.statuses.find((s) => s.name === name)!
  const created = []
  for (let i = 0; i < count; i++) {
    created.push(
      await owner.client.issues.create({ workspaceSlug: 'tip', teamId: team.id, title: `#${i}` }),
    )
  }
  return {
    owner,
    workspace,
    team,
    status,
    issues: owner.client.issues,
    ids: created.map((i) => i.id),
  }
}

/** Activity rows per issue, leaving out the `created` entry every issue starts with. */
async function activityCounts(ids: string[]) {
  const rows = await db
    .select({ issueId: activityLog.issueId, kind: activityLog.kind })
    .from(activityLog)
    .where(and(inArray(activityLog.issueId, ids), ne(activityLog.kind, 'created')))
  return ids.map((id) => rows.filter((row) => row.issueId === id).map((row) => row.kind))
}

describe('issues.bulkUpdate', () => {
  it('applies status, priority, assignee and labels to every issue with one activity row each', async () => {
    const { owner, workspace, status, issues, ids } = await workspaceWithIssues()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const bug = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'Bug',
      color: '#eb5757',
    })
    const ui = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'UI',
      color: '#5e6ad2',
    })
    await issues.update({ workspaceSlug: 'tip', id: ids[0]!, labelIds: [ui.id] })

    const done = await issues.bulkUpdate({
      workspaceSlug: 'tip',
      ids,
      patch: { statusId: status('Done').id },
    })
    expect(done.items.map((i) => i.id).sort()).toEqual([...ids].sort())
    for (const issue of done.items) {
      expect(issue.status.id).toBe(status('Done').id)
      expect(issue.completedAt).toBeInstanceOf(Date)
    }
    expect((await activityCounts(ids)).map((kinds) => kinds.sort())).toEqual([
      ['labels', 'status'],
      ['status'],
      ['status'],
    ])

    await issues.bulkUpdate({ workspaceSlug: 'tip', ids, patch: { priority: 1 } })
    await issues.bulkUpdate({ workspaceSlug: 'tip', ids, patch: { assigneeId: member.userId } })
    const labelled = await issues.bulkUpdate({
      workspaceSlug: 'tip',
      ids,
      patch: { addLabelIds: [bug.id], removeLabelIds: [ui.id] },
    })
    for (const issue of labelled.items) {
      expect(issue).toMatchObject({ priority: 1, assigneeId: member.userId, labels: [bug] })
    }
    const counts = await activityCounts(ids)
    for (const kinds of counts.slice(1))
      expect(kinds.sort()).toEqual(['assignee', 'labels', 'priority', 'status'])

    // Reopening clears completedAt, like a single update.
    const reopened = await issues.bulkUpdate({
      workspaceSlug: 'tip',
      ids: [ids[1]!],
      patch: { statusId: status('Todo').id },
    })
    expect(reopened.items[0]!.completedAt).toBeNull()
  })

  it('rolls every issue back when one of them is rejected', async () => {
    const { owner, team, issues, ids } = await workspaceWithIssues(1)
    const ops = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Ops', key: 'OPS' })
    const opsIssue = await issues.create({ workspaceSlug: 'tip', teamId: ops.id, title: 'Ops' })
    const tipLabel = await owner.client.labels.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      name: 'Tip only',
      color: '#eb5757',
    })

    // The label belongs to TIP, so the OPS issue fails after the TIP one succeeded.
    await expect(
      issues.bulkUpdate({
        workspaceSlug: 'tip',
        ids: [ids[0]!, opsIssue.id],
        patch: { priority: 2, addLabelIds: [tipLabel.id] },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const rows = await db
      .select()
      .from(issuesTable)
      .where(inArray(issuesTable.id, [ids[0]!, opsIssue.id]))
    expect(rows.map((row) => row.priority)).toEqual([0, 0])
    expect(await activityCounts([ids[0]!, opsIssue.id])).toEqual([[], []])
  })

  it('rejects more than 250 ids and an empty patch', async () => {
    const { issues, ids } = await workspaceWithIssues(1)
    const many = Array.from({ length: 251 }, () => crypto.randomUUID())
    await expect(
      issues.bulkUpdate({ workspaceSlug: 'tip', ids: many, patch: { priority: 1 } }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(issues.bulkDelete({ workspaceSlug: 'tip', ids: many })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    await expect(issues.bulkUpdate({ workspaceSlug: 'tip', ids, patch: {} })).rejects.toMatchObject(
      { code: 'BAD_REQUEST' },
    )
  })

  it('fails with NOT_FOUND and changes nothing when any id is from another workspace', async () => {
    const { issues, ids } = await workspaceWithIssues(2)
    const other = await signUp(app, 'Other')
    await other.client.workspaces.create({ name: 'Other', slug: 'other' })
    const otherTeam = await other.client.teams.create({
      workspaceSlug: 'other',
      name: 'Other',
      key: 'OTH',
    })
    const foreign = await other.client.issues.create({
      workspaceSlug: 'other',
      teamId: otherTeam.id,
      title: 'Not yours',
    })

    await expect(
      issues.bulkUpdate({
        workspaceSlug: 'tip',
        ids: [...ids, foreign.id],
        patch: { priority: 1 },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      issues.bulkDelete({ workspaceSlug: 'tip', ids: [...ids, foreign.id] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const rows = await db.select().from(issuesTable)
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.priority === 0)).toBe(true)

    // A non-member can't reach the workspace at all.
    await expect(
      other.client.issues.bulkUpdate({ workspaceSlug: 'tip', ids, patch: { priority: 1 } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('issues.bulkDelete', () => {
  it('deletes every issue and frees sub-issues outside the batch', async () => {
    const { team, issues, ids } = await workspaceWithIssues(2)
    const child = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Child',
      parentId: ids[0]!,
    })

    await expect(issues.bulkDelete({ workspaceSlug: 'tip', ids })).resolves.toEqual({ ids })
    const rows = await db.select().from(issuesTable).where(eq(issuesTable.teamId, team.id))
    expect(rows.map((row) => [row.id, row.parentId])).toEqual([[child.id, null]])
  })
})
