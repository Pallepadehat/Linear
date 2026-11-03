import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function arrange(scale: 'fibonacci' | 'off' = 'fibonacci') {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  if (scale !== 'off') {
    await owner.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', estimateScale: scale })
  }
  return { owner, workspace, team, issues: owner.client.issues }
}

describe('estimates', () => {
  it('lets the owner set the scale and zero rule; teams expose both', async () => {
    const { owner } = await arrange('off')
    expect(await owner.client.teams.get({ workspaceSlug: 'tip', key: 'TIP' })).toMatchObject({
      estimateScale: 'off',
      estimateAllowZero: false,
    })
    const updated = await owner.client.teams.update({
      workspaceSlug: 'tip',
      key: 'TIP',
      estimateScale: 'tshirt',
      estimateAllowZero: true,
    })
    expect(updated).toMatchObject({ estimateScale: 'tshirt', estimateAllowZero: true })
    const [listed] = await owner.client.teams.list({ workspaceSlug: 'tip' })
    expect(listed).toMatchObject({ estimateScale: 'tshirt', estimateAllowZero: true })
  })

  it('keeps estimate settings owner-only', async () => {
    const { workspace } = await arrange()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    await expect(
      member.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', estimateScale: 'linear' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('sets, changes and clears an estimate, recording activity', async () => {
    const { owner, team, issues } = await arrange()
    const created = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Sized',
      estimate: 3,
    })
    expect(created.estimate).toBe(3)
    expect(
      (await issues.update({ workspaceSlug: 'tip', id: created.id, estimate: 8 })).estimate,
    ).toBe(8)
    const cleared = await issues.update({ workspaceSlug: 'tip', id: created.id, estimate: null })
    expect(cleared.estimate).toBeNull()

    const { items } = await owner.client.activity.list({ workspaceSlug: 'tip', issueId: created.id })
    expect(
      items.filter((a) => a.kind === 'estimate').map((a) => [a.from, a.to]),
    ).toEqual([
      [3, 8],
      [8, null],
    ])
  })

  it('rejects values off the scale, zero unless allowed, and any value when off', async () => {
    const { owner, team, issues } = await arrange()
    const { id } = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'X' })
    const bad = { code: 'BAD_REQUEST' }
    await expect(issues.update({ workspaceSlug: 'tip', id, estimate: 4 })).rejects.toMatchObject(bad)
    await expect(issues.update({ workspaceSlug: 'tip', id, estimate: 0 })).rejects.toMatchObject(bad)
    await expect(
      issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'Y', estimate: 4 }),
    ).rejects.toMatchObject(bad)

    await owner.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', estimateAllowZero: true })
    expect((await issues.update({ workspaceSlug: 'tip', id, estimate: 0 })).estimate).toBe(0)

    // Turning estimates off keeps the stored value, but no new one can be set.
    await owner.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', estimateScale: 'off' })
    const kept = await issues.update({ workspaceSlug: 'tip', id, title: 'Renamed' })
    expect(kept.estimate).toBe(0)
    await expect(issues.update({ workspaceSlug: 'tip', id, estimate: 1 })).rejects.toMatchObject(bad)
    expect((await issues.update({ workspaceSlug: 'tip', id, estimate: null })).estimate).toBeNull()
  })

  it('filters and sorts by estimate across pages', async () => {
    const { team, issues } = await arrange()
    const make = async (title: string, estimate?: number) =>
      issues.create({ workspaceSlug: 'tip', teamId: team.id, title, estimate })
    await make('none')
    await make('one', 1)
    await make('eight', 8)
    await make('three', 3)
    await make('eight-again', 8)

    const titles = async (input: Parameters<typeof issues.list>[0]) =>
      (await issues.list(input)).items.map((i) => i.title)

    expect(await titles({ workspaceSlug: 'tip', estimates: [null] })).toEqual(['none'])
    expect((await titles({ workspaceSlug: 'tip', estimates: ['any'] })).length).toBe(4)
    expect(await titles({ workspaceSlug: 'tip', estimates: [3, null] })).toEqual([
      'three',
      'none',
    ])

    // Largest first, newest first within a value, no estimate last; paged one by one.
    for (const [direction, expected] of [
      ['desc', ['eight-again', 'eight', 'three', 'one', 'none']],
      ['asc', ['one', 'three', 'eight-again', 'eight', 'none']],
    ] as const) {
      const seen: string[] = []
      let cursor: string | null = null
      do {
        const page: Awaited<ReturnType<typeof issues.list>> = await issues.list({
          workspaceSlug: 'tip',
          sort: 'estimate',
          direction,
          limit: 2,
          cursor,
        })
        seen.push(...page.items.map((i) => i.title))
        cursor = page.nextCursor
      } while (cursor)
      expect(seen).toEqual(expected)
    }
  })

  it('returns NOT_FOUND for an issue in another workspace', async () => {
    const { team, issues } = await arrange()
    const { id } = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'Secret' })
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    await expect(
      stranger.client.issues.update({ workspaceSlug: 'mine', id, estimate: 3 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.issues.update({ workspaceSlug: 'tip', id, estimate: 3 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
