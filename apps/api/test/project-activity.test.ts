import { projectActivity } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }

async function projectInTip() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ ...scope, name: 'Tip', key: 'TIP' })
  const project = await owner.client.projects.create({ ...scope, name: 'Launch' })
  const feed = (cursor?: string | null, limit?: number) =>
    owner.client.projects.activity({ ...scope, projectId: project.id, cursor, limit })
  return { owner, workspace, team, project, feed }
}

describe('projects.activity', () => {
  it('logs creation with the creator as actor', async () => {
    const { owner, project, feed } = await projectInTip()
    expect(await feed()).toEqual({
      items: [
        {
          id: expect.any(String),
          projectId: project.id,
          actorType: 'user',
          actor: { id: owner.userId, name: 'Owner', avatarUrl: null },
          kind: 'project.created',
          payload: {},
          createdAt: expect.any(Date),
        },
      ],
      nextCursor: null,
    })
  })

  it('writes status, priority, lead and date changes newest first, attributed to the editor', async () => {
    const { workspace, project, feed } = await projectInTip()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    await member.client.projects.update({
      ...scope,
      id: project.id,
      status: 'in_progress',
      priority: 2,
      leadId: member.userId,
      startDate: '2026-11-01',
      targetDate: '2026-12-01',
      name: 'Renamed',
    })
    // Same values again write nothing.
    await member.client.projects.update({ ...scope, id: project.id, status: 'in_progress' })

    const { items } = await feed()
    expect(items.map((item) => [item.kind, item.payload])).toEqual([
      ['project.dates_changed', { field: 'targetDate', from: null, to: '2026-12-01' }],
      ['project.dates_changed', { field: 'startDate', from: null, to: '2026-11-01' }],
      ['project.lead_changed', { from: null, to: member.userId }],
      ['project.priority_changed', { from: 0, to: 2 }],
      ['project.status_changed', { from: 'planned', to: 'in_progress' }],
      ['project.created', {}],
    ])
    expect(items[0]!.actor).toEqual({ id: member.userId, name: 'Member', avatarUrl: null })
  })

  it('logs issues added to and removed from the project', async () => {
    const { owner, team, project, feed } = await projectInTip()
    const other = await owner.client.projects.create({ ...scope, name: 'Other' })
    const issue = await owner.client.issues.create({
      ...scope,
      teamId: team.id,
      title: 'Fix login',
      projectId: project.id,
    })
    const ref = { issueId: issue.id, identifier: 'TIP-1', title: 'Fix login' }
    await owner.client.issues.update({ ...scope, id: issue.id, projectId: other.id })
    // Not a project change: nothing more is written.
    await owner.client.issues.update({ ...scope, id: issue.id, priority: 1 })

    expect((await feed()).items.map((item) => [item.kind, item.payload])).toEqual([
      ['project.issue_removed', ref],
      ['project.issue_added', ref],
      ['project.created', {}],
    ])
    const otherFeed = await owner.client.projects.activity({ ...scope, projectId: other.id })
    expect(otherFeed.items.map((item) => item.kind)).toEqual([
      'project.issue_added',
      'project.created',
    ])
  })

  it('logs each issue a bulk update adds to the project', async () => {
    const { owner, team, project, feed } = await projectInTip()
    const created = await Promise.all(
      ['One', 'Two'].map((title) =>
        owner.client.issues.create({ ...scope, teamId: team.id, title }),
      ),
    )
    await owner.client.issues.bulkUpdate({
      ...scope,
      ids: created.map((issue) => issue.id),
      patch: { projectId: project.id },
    })
    const added = (await feed()).items.filter((item) => item.kind === 'project.issue_added')
    expect(added.map((item) => item.payload)).toEqual(
      expect.arrayContaining(
        created.map((issue) => expect.objectContaining({ issueId: issue.id, title: issue.title })),
      ),
    )
    expect(added).toHaveLength(2)
  })

  it('pages newest first with a cursor', async () => {
    const { owner, project, feed } = await projectInTip()
    for (const priority of [1, 2, 3, 4]) {
      await owner.client.projects.update({ ...scope, id: project.id, priority })
    }
    const first = await feed(null, 2)
    expect(first.items.map((item) => item.payload)).toEqual([
      { from: 3, to: 4 },
      { from: 2, to: 3 },
    ])
    expect(first.nextCursor).toBe(first.items[1]!.id)
    const second = await feed(first.nextCursor, 2)
    expect(second.items.map((item) => item.payload)).toEqual([
      { from: 1, to: 2 },
      { from: 0, to: 1 },
    ])
    const last = await feed(second.nextCursor, 2)
    expect(last).toEqual({
      items: [expect.objectContaining({ kind: 'project.created' })],
      nextCursor: null,
    })
    await expect(feed('not-a-cursor')).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('keeps entries of deleted users without an actor and deletes them with the project', async () => {
    const { owner, project, feed } = await projectInTip()
    await db
      .update(projectActivity)
      .set({ actorId: null })
      .where(eq(projectActivity.projectId, project.id))
    expect((await feed()).items[0]).toMatchObject({ actorType: 'user', actor: null })
    await owner.client.projects.delete({ ...scope, id: project.id })
    expect(
      await db.select().from(projectActivity).where(eq(projectActivity.projectId, project.id)),
    ).toEqual([])
  })

  it('returns NOT_FOUND for a project in another workspace, and for non-members', async () => {
    const { project } = await projectInTip()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
    await expect(
      outsider.client.projects.activity({ workspaceSlug: 'other', projectId: project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      outsider.client.projects.activity({ ...scope, projectId: project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
