import { cycles } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  const status = (category: string) => team.statuses.find((s) => s.category === category)!
  return { owner, member, workspace, team, status }
}

async function enableCycles(client: Awaited<ReturnType<typeof arrange>>['owner']['client']) {
  return client.teams.update({ workspaceSlug: 'tip', key: 'TIP', cyclesEnabled: true })
}

describe('cycles', () => {
  it('defaults to cycles off and lets owners change the settings', async () => {
    const { owner, team } = await arrange()
    expect(team).toMatchObject({
      cyclesEnabled: false,
      cycleDurationWeeks: 2,
      cycleStartWeekday: 1,
      cycleCooldownWeeks: 0,
      cycleUpcomingCount: 2,
      cycleAutoAddStarted: true,
      cycleRolloverUnfinished: true,
    })
    expect(await owner.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id })).toEqual([])

    const updated = await owner.client.teams.update({
      workspaceSlug: 'tip',
      key: 'TIP',
      cyclesEnabled: true,
      cycleDurationWeeks: 1,
      cycleUpcomingCount: 3,
    })
    expect(updated).toMatchObject({
      cyclesEnabled: true,
      cycleDurationWeeks: 1,
      cycleUpcomingCount: 3,
    })

    // Enabling schedules right away: the current cycle plus three upcoming ones.
    const list = await owner.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id })
    expect(list.map((c) => c.number)).toEqual([1, 2, 3, 4])
    const [current] = list
    expect(current!.startsAt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(current!.endsAt.getTime() - current!.startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    expect(current!.progress).toEqual({ scope: 0, started: 0, completed: 0 })
  })

  it('keeps cycle settings owner-only and validated', async () => {
    const { member, owner } = await arrange()
    await expect(
      member.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', cyclesEnabled: true }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      owner.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', cycleDurationWeeks: 9 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      owner.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', cycleStartWeekday: 7 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('assigns issues to a cycle, lists progress and filters by cycle', async () => {
    const { owner, member, team, status } = await arrange()
    await enableCycles(owner.client)
    const [current, upcoming] = await member.client.cycles.list({
      workspaceSlug: 'tip',
      teamId: team.id,
    })

    const a = await member.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'A',
      cycleId: current!.id,
    })
    expect(a.cycleId).toBe(current!.id)
    const b = await member.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'B',
    })
    expect(b.cycleId).toBeNull()
    await member.client.issues.update({
      workspaceSlug: 'tip',
      id: b.id,
      cycleId: current!.id,
      statusId: status('completed').id,
    })
    await member.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'C',
      cycleId: upcoming!.id,
    })

    const [withProgress] = await member.client.cycles.list({
      workspaceSlug: 'tip',
      teamId: team.id,
    })
    expect(withProgress!.progress).toEqual({ scope: 2, started: 0, completed: 1 })

    const inCycle = await member.client.issues.list({ workspaceSlug: 'tip', cycleId: current!.id })
    expect(inCycle.items.map((i) => i.title).sort()).toEqual(['A', 'B'])
    const noCycle = await member.client.issues.list({
      workspaceSlug: 'tip',
      cycleIds: [null, upcoming!.id],
    })
    expect(noCycle.items.map((i) => i.title)).toEqual(['C'])

    const cleared = await member.client.issues.update({
      workspaceSlug: 'tip',
      id: a.id,
      cycleId: null,
    })
    expect(cleared.cycleId).toBeNull()
    const activity = await member.client.activity.list({ workspaceSlug: 'tip', issueId: a.id })
    expect(activity.items.filter((e) => e.kind === 'cycle').map((e) => [e.from, e.to])).toEqual([
      [current!.id, null],
    ])
  })

  it('auto-adds issues moved to a started status to the current cycle', async () => {
    const { owner, team, status } = await arrange()
    await enableCycles(owner.client)
    const [current] = await owner.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id })
    const issue = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'A',
    })

    const started = await owner.client.issues.update({
      workspaceSlug: 'tip',
      id: issue.id,
      statusId: status('started').id,
    })
    expect(started.cycleId).toBe(current!.id)

    // Off: the issue stays out of the cycle.
    await owner.client.teams.update({
      workspaceSlug: 'tip',
      key: 'TIP',
      cycleAutoAddStarted: false,
    })
    const other = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'B',
    })
    const moved = await owner.client.issues.update({
      workspaceSlug: 'tip',
      id: other.id,
      statusId: status('started').id,
    })
    expect(moved.cycleId).toBeNull()
  })

  it('rejects cycles from another team or that are completed', async () => {
    const { owner, team } = await arrange()
    await enableCycles(owner.client)
    const otherTeam = await owner.client.teams.create({
      workspaceSlug: 'tip',
      name: 'Ops',
      key: 'OPS',
    })
    await owner.client.teams.update({ workspaceSlug: 'tip', key: 'OPS', cyclesEnabled: true })
    const [opsCycle] = await owner.client.cycles.list({
      workspaceSlug: 'tip',
      teamId: otherTeam.id,
    })
    const [current] = await owner.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id })

    await expect(
      owner.client.issues.create({
        workspaceSlug: 'tip',
        teamId: team.id,
        title: 'X',
        cycleId: opsCycle!.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const issue = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Y',
    })
    await db.update(cycles).set({ completedAt: new Date() }).where(eq(cycles.id, current!.id))
    await expect(
      owner.client.issues.update({ workspaceSlug: 'tip', id: issue.id, cycleId: current!.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('renames cycles and returns the snapshot', async () => {
    const { owner, member, team } = await arrange()
    await enableCycles(owner.client)
    const [current] = await member.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id })
    const renamed = await member.client.cycles.update({
      workspaceSlug: 'tip',
      id: current!.id,
      name: ' Launch ',
    })
    expect(renamed).toMatchObject({ name: 'Launch', scopeSnapshot: [], completedSnapshot: [] })
    const fetched = await member.client.cycles.get({ workspaceSlug: 'tip', id: current!.id })
    expect(fetched.name).toBe('Launch')
    const cleared = await member.client.cycles.update({
      workspaceSlug: 'tip',
      id: current!.id,
      name: '',
    })
    expect(cleared.name).toBeNull()
  })

  it('hides cycles from other workspaces', async () => {
    const { owner, team } = await arrange()
    await enableCycles(owner.client)
    const [current] = await owner.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id })

    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Other', slug: 'other' })
    const theirTeam = await stranger.client.teams.create({
      workspaceSlug: 'other',
      name: 'O',
      key: 'OTH',
    })

    await expect(
      stranger.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.cycles.list({ workspaceSlug: 'other', teamId: team.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.cycles.get({ workspaceSlug: 'other', id: current!.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.cycles.update({ workspaceSlug: 'other', id: current!.id, name: 'Mine' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // An issue in their workspace can't be put in our cycle.
    await expect(
      stranger.client.issues.create({
        workspaceSlug: 'other',
        teamId: theirTeam.id,
        title: 'X',
        cycleId: current!.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
