import { projectUpdates } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }

async function tipWithProject() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const project = await owner.client.projects.create({ ...scope, name: 'Launch' })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  return { owner, member, project }
}

describe('project updates', () => {
  it('creates an update that sets the project health', async () => {
    const { owner, member, project } = await tipWithProject()
    expect(project).toMatchObject({ health: null, lastUpdateAt: null })

    const update = await member.client.projectUpdates.create({
      ...scope,
      projectId: project.id,
      health: 'at_risk',
      body: '  Blocked on **design** review ',
    })
    expect(update).toEqual({
      id: expect.any(String),
      projectId: project.id,
      author: { id: member.userId, name: 'Member', avatarUrl: null },
      health: 'at_risk',
      body: 'Blocked on **design** review',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })

    const got = await owner.client.projects.get({ ...scope, id: project.id })
    expect(got).toMatchObject({ health: 'at_risk', lastUpdateAt: update.createdAt })

    // The latest update wins, in the list too.
    const next = await owner.client.projectUpdates.create({
      ...scope,
      projectId: project.id,
      health: 'on_track',
      body: 'Unblocked',
    })
    const other = await owner.client.projects.create({ ...scope, name: 'Quiet' })
    const list = await owner.client.projects.list(scope)
    expect(list.find((p) => p.id === project.id)).toMatchObject({
      health: 'on_track',
      lastUpdateAt: next.createdAt,
    })
    expect(list.find((p) => p.id === other.id)).toMatchObject({ health: null, lastUpdateAt: null })
  })

  it('writes project_update.posted to the project activity feed', async () => {
    const { owner, project } = await tipWithProject()
    const update = await owner.client.projectUpdates.create({
      ...scope,
      projectId: project.id,
      health: 'on_track',
      body: 'Week 1',
    })
    const feed = await owner.client.projects.activity({ ...scope, projectId: project.id })
    expect(feed.items[0]).toMatchObject({
      kind: 'project_update.posted',
      payload: { updateId: update.id },
      actorType: 'user',
      actor: { id: owner.userId, name: 'Owner' },
    })

    // Deleting the update removes its entry, so the feed never points at nothing.
    await owner.client.projectUpdates.delete({ ...scope, id: update.id })
    const after = await owner.client.projects.activity({ ...scope, projectId: project.id })
    expect(after.items.map((item) => item.kind)).not.toContain('project_update.posted')
  })

  it('lists newest first with cursor pagination', async () => {
    const { owner, project } = await tipWithProject()
    const created = []
    for (const body of ['one', 'two', 'three', 'four', 'five']) {
      created.push(
        await owner.client.projectUpdates.create({
          ...scope,
          projectId: project.id,
          health: 'on_track',
          body,
        }),
      )
    }
    const first = await owner.client.projectUpdates.list({
      ...scope,
      projectId: project.id,
      limit: 2,
    })
    expect(first.items.map((u) => u.body)).toEqual(['five', 'four'])
    expect(first.nextCursor).toBe(created[3]?.id)

    const second = await owner.client.projectUpdates.list({
      ...scope,
      projectId: project.id,
      limit: 2,
      cursor: first.nextCursor,
    })
    expect(second.items.map((u) => u.body)).toEqual(['three', 'two'])
    const last = await owner.client.projectUpdates.list({
      ...scope,
      projectId: project.id,
      limit: 2,
      cursor: second.nextCursor,
    })
    expect(last).toMatchObject({ items: [{ body: 'one' }], nextCursor: null })

    await expect(
      owner.client.projectUpdates.list({ ...scope, projectId: project.id, cursor: 'nope' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('pages through updates posted in the same millisecond without skipping any', async () => {
    const { owner, project } = await tipWithProject()
    const ids: string[] = []
    for (const body of ['a', 'b', 'c', 'd', 'e']) {
      const update = await owner.client.projectUpdates.create({
        ...scope,
        projectId: project.id,
        health: 'on_track',
        body,
      })
      ids.push(update.id)
    }
    // Microseconds apart inside one millisecond (a JS Date can't tell them apart), and
    // two exact ties, which fall back to the id.
    const offsets = [100, 200, 300, 300, 400]
    for (const [i, id] of ids.entries()) {
      await db
        .update(projectUpdates)
        .set({
          createdAt: sql`timestamptz '2026-11-03 10:00:00.123' + make_interval(secs => ${offsets[i]! / 1e6})`,
        })
        .where(eq(projectUpdates.id, id))
    }

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page: Awaited<ReturnType<typeof owner.client.projectUpdates.list>> =
        await owner.client.projectUpdates.list({
          ...scope,
          projectId: project.id,
          limit: 2,
          cursor,
        })
      seen.push(...page.items.map((u) => u.body))
      cursor = page.nextCursor
    } while (cursor)
    expect(seen).toEqual(['e', 'd', 'c', 'b', 'a'])
  })

  it('lets only the author edit', async () => {
    const { owner, member, project } = await tipWithProject()
    const update = await member.client.projectUpdates.create({
      ...scope,
      projectId: project.id,
      health: 'on_track',
      body: 'Fine',
    })
    // Owners included: editing someone else's words isn't a moderation action.
    await expect(
      owner.client.projectUpdates.update({ ...scope, id: update.id, body: 'Mine now' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const edited = await member.client.projectUpdates.update({
      ...scope,
      id: update.id,
      health: 'off_track',
      body: 'Not fine',
    })
    expect(edited).toMatchObject({ health: 'off_track', body: 'Not fine' })
    expect(edited.updatedAt.getTime()).toBeGreaterThan(update.updatedAt.getTime())
    expect((await owner.client.projects.get({ ...scope, id: project.id })).health).toBe('off_track')

    await expect(
      member.client.projectUpdates.update({ ...scope, id: update.id, body: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('lets the author or a workspace owner delete', async () => {
    const { owner, member, project } = await tipWithProject()
    const byOwner = await owner.client.projectUpdates.create({
      ...scope,
      projectId: project.id,
      health: 'at_risk',
      body: 'Owner post',
    })
    const byMember = await member.client.projectUpdates.create({
      ...scope,
      projectId: project.id,
      health: 'off_track',
      body: 'Member post',
    })

    await expect(
      member.client.projectUpdates.delete({ ...scope, id: byOwner.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await owner.client.projectUpdates.delete({ ...scope, id: byMember.id })).toEqual({
      id: byMember.id,
    })
    // Health falls back to the remaining latest update, then to none.
    expect((await owner.client.projects.get({ ...scope, id: project.id })).health).toBe('at_risk')
    await owner.client.projectUpdates.delete({ ...scope, id: byOwner.id })
    expect(await owner.client.projects.get({ ...scope, id: project.id })).toMatchObject({
      health: null,
      lastUpdateAt: null,
    })
  })

  it('returns NOT_FOUND for projects and updates in another workspace', async () => {
    const { owner } = await tipWithProject()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
    const theirs = await outsider.client.projects.create({ workspaceSlug: 'other', name: 'Theirs' })
    const update = await outsider.client.projectUpdates.create({
      workspaceSlug: 'other',
      projectId: theirs.id,
      health: 'on_track',
      body: 'Private',
    })

    const projectId = theirs.id
    await expect(owner.client.projectUpdates.list({ ...scope, projectId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      owner.client.projectUpdates.create({ ...scope, projectId, health: 'at_risk', body: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      owner.client.projectUpdates.update({ ...scope, id: update.id, body: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      owner.client.projectUpdates.delete({ ...scope, id: update.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      owner.client.projectUpdates.list({ workspaceSlug: 'other', projectId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // Another project's update id isn't a valid cursor, so it can't be used as a probe.
    const mine = await owner.client.projects.create({ ...scope, name: 'Mine' })
    await expect(
      owner.client.projectUpdates.list({ ...scope, projectId: mine.id, cursor: update.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const { items } = await outsider.client.projectUpdates.list({
      workspaceSlug: 'other',
      projectId,
    })
    expect(items).toMatchObject([{ id: update.id, body: 'Private' }])
  })

  it('deletes updates with their project', async () => {
    const { owner, project } = await tipWithProject()
    await owner.client.projectUpdates.create({
      ...scope,
      projectId: project.id,
      health: 'on_track',
      body: 'x',
    })
    await owner.client.projects.delete({ ...scope, id: project.id })
    await expect(
      owner.client.projectUpdates.list({ ...scope, projectId: project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
