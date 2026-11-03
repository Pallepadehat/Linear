import type { ListIssuesInput } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app } = await setupTestApp()

async function workspaceWithTeam() {
  const owner = await signUp(app, 'Owner')
  await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const status = (name: string) => team.statuses.find((s) => s.name === name)!
  return { owner, team, status, issues: owner.client.issues }
}

describe('due dates', () => {
  it('sets, changes and clears a due date, logging each change', async () => {
    const { owner, team, issues } = await workspaceWithTeam()
    const issue = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Ship',
      dueDate: '2026-11-07',
    })
    expect(issue.dueDate).toBe('2026-11-07')
    expect(await issues.get({ workspaceSlug: 'tip', id: issue.id })).toMatchObject({
      dueDate: '2026-11-07',
    })

    const moved = await issues.update({ workspaceSlug: 'tip', id: issue.id, dueDate: '2026-12-01' })
    expect(moved.dueDate).toBe('2026-12-01')
    // Omitted leaves it unchanged; null clears it.
    await issues.update({ workspaceSlug: 'tip', id: issue.id, title: 'Ship it' })
    expect((await issues.get({ workspaceSlug: 'tip', id: issue.id })).dueDate).toBe('2026-12-01')
    const cleared = await issues.update({ workspaceSlug: 'tip', id: issue.id, dueDate: null })
    expect(cleared.dueDate).toBeNull()

    const { items } = await owner.client.activity.list({ workspaceSlug: 'tip', issueId: issue.id })
    expect(
      items.filter((e) => e.kind === 'due_date').map((e) => ({ from: e.from, to: e.to })),
    ).toEqual([
      { from: '2026-11-07', to: '2026-12-01' },
      { from: '2026-12-01', to: null },
    ])
  })

  it('rejects invalid dates', async () => {
    const { team, issues } = await workspaceWithTeam()
    const issue = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'X' })
    const bad = { code: 'BAD_REQUEST' }
    for (const dueDate of ['2026-02-30', '2026-11-7', 'tomorrow', '2026-11-07T10:00:00Z']) {
      await expect(
        issues.update({ workspaceSlug: 'tip', id: issue.id, dueDate }),
        dueDate,
      ).rejects.toMatchObject(bad)
    }
    await expect(
      issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'Y', dueDate: '2026-13-01' }),
    ).rejects.toMatchObject(bad)
    await expect(
      issues.list({ workspaceSlug: 'tip', due: ['overdue'] }),
      'relative filters need today',
    ).rejects.toMatchObject(bad)
    await expect(
      issues.list({ workspaceSlug: 'tip', due: ['dueThisWeek'], today: '2026-02-30' }),
    ).rejects.toMatchObject(bad)
  })

  it('filters by overdue, due this week and no due date relative to the given today', async () => {
    const { team, status, issues } = await workspaceWithTeam()
    const create = (title: string, fields: Record<string, unknown> = {}) =>
      issues.create({ workspaceSlug: 'tip', teamId: team.id, title, ...fields })
    // Today is Tuesday 2026-11-03; its week ends Sunday 2026-11-08.
    await create('Yesterday', { dueDate: '2026-11-02' }) // TIP-1 overdue
    await create('Done late', { dueDate: '2026-10-01', statusId: status('Done').id }) // TIP-2
    await create('Today', { dueDate: '2026-11-03' }) // TIP-3
    await create('Sunday', { dueDate: '2026-11-08' }) // TIP-4
    await create('Next Monday', { dueDate: '2026-11-09' }) // TIP-5
    await create('Someday') // TIP-6
    const ids = async (filter: Partial<ListIssuesInput>) =>
      (await issues.list({ workspaceSlug: 'tip', today: '2026-11-03', ...filter })).items.map(
        (i) => i.identifier,
      )

    expect(await ids({ due: ['overdue'] })).toEqual(['TIP-1'])
    expect(await ids({ due: ['dueThisWeek'] })).toEqual(['TIP-4', 'TIP-3'])
    expect(await ids({ due: ['noDueDate'] })).toEqual(['TIP-6'])
    expect(await ids({ due: ['overdue', 'noDueDate'] })).toEqual(['TIP-6', 'TIP-1'])
    // "Today" is the client's day: a day later, Today's issue is overdue too.
    expect(await ids({ due: ['overdue'], today: '2026-11-04' })).toEqual(['TIP-3', 'TIP-1'])
    // On Sunday the week is just that day; Monday starts a new one.
    expect(await ids({ due: ['dueThisWeek'], today: '2026-11-08' })).toEqual(['TIP-4'])
    expect(await ids({ due: ['dueThisWeek'], today: '2026-11-09' })).toEqual(['TIP-5'])
    // noDueDate alone doesn't need today.
    expect(
      (await issues.list({ workspaceSlug: 'tip', due: ['noDueDate'] })).items.map(
        (i) => i.identifier,
      ),
    ).toEqual(['TIP-6'])
  })

  it('sorts by due date with no due date last in both directions, paging stably', async () => {
    const { team, issues } = await workspaceWithTeam()
    const create = (title: string, dueDate?: string) =>
      issues.create({ workspaceSlug: 'tip', teamId: team.id, title, dueDate })
    await create('A', '2026-11-10') // TIP-1
    await create('B') // TIP-2
    await create('C', '2026-11-05') // TIP-3
    await create('D', '2026-11-10') // TIP-4 (ties with TIP-1)
    await create('E') // TIP-5
    await create('F', '2026-12-24') // TIP-6

    const list = (direction: 'asc' | 'desc', cursor: string | null = null, limit = 50) =>
      issues.list({ workspaceSlug: 'tip', sort: 'dueDate', direction, cursor, limit })
    const ids = async (direction: 'asc' | 'desc') =>
      (await list(direction)).items.map((i) => i.identifier)

    expect(await ids('asc')).toEqual(['TIP-3', 'TIP-1', 'TIP-4', 'TIP-6', 'TIP-2', 'TIP-5'])
    expect(await ids('desc')).toEqual(['TIP-6', 'TIP-4', 'TIP-1', 'TIP-3', 'TIP-5', 'TIP-2'])

    for (const direction of ['asc', 'desc'] as const) {
      const walked: string[] = []
      let cursor: string | null = null
      do {
        const page = await list(direction, cursor, 1)
        walked.push(...page.items.map((i) => i.identifier))
        cursor = page.nextCursor
      } while (cursor)
      expect(walked, direction).toEqual(await ids(direction))
    }
  })

  it('hides due dates of issues in other workspaces', async () => {
    const { team, issues } = await workspaceWithTeam()
    const issue = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'Secret' })
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })

    await expect(
      stranger.client.issues.update({ workspaceSlug: 'mine', id: issue.id, dueDate: '2026-11-07' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.issues.update({ workspaceSlug: 'tip', id: issue.id, dueDate: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await issues.get({ workspaceSlug: 'tip', id: issue.id })).dueDate).toBeNull()
  })
})
