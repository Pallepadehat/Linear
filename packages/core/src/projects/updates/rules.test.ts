import { describe, expect, it } from 'vitest'
import { healthByProject, projectHealthOf } from './rules'

const P1 = '00000000-0000-7000-8000-000000000001'
const P2 = '00000000-0000-7000-8000-000000000002'
const at = (iso: string) => new Date(iso)

describe('projectHealthOf', () => {
  it('is null with no updates', () => {
    expect(projectHealthOf([])).toEqual({ health: null, lastUpdateAt: null })
  })

  it('takes the latest update, whatever the input order', () => {
    const updates = [
      { id: 'b', projectId: P1, health: 'at_risk' as const, createdAt: at('2026-11-02T10:00Z') },
      { id: 'c', projectId: P1, health: 'off_track' as const, createdAt: at('2026-11-03T10:00Z') },
      { id: 'a', projectId: P1, health: 'on_track' as const, createdAt: at('2026-11-01T10:00Z') },
    ]
    expect(projectHealthOf(updates)).toEqual({
      health: 'off_track',
      lastUpdateAt: at('2026-11-03T10:00Z'),
    })
  })

  it('breaks a timestamp tie by the later id', () => {
    const time = at('2026-11-03T10:00Z')
    expect(
      projectHealthOf([
        { id: '0001', projectId: P1, health: 'on_track', createdAt: time },
        { id: '0002', projectId: P1, health: 'at_risk', createdAt: time },
      ]).health,
    ).toBe('at_risk')
  })
})

describe('healthByProject', () => {
  it('derives each project from its own updates only', () => {
    const map = healthByProject([
      { id: 'a', projectId: P1, health: 'on_track', createdAt: at('2026-11-03T10:00Z') },
      { id: 'b', projectId: P2, health: 'off_track', createdAt: at('2026-11-01T10:00Z') },
      { id: 'c', projectId: P1, health: 'at_risk', createdAt: at('2026-11-02T10:00Z') },
    ])
    expect(map.get(P1)?.health).toBe('on_track')
    expect(map.get(P2)?.health).toBe('off_track')
    expect(map.has('missing')).toBe(false)
  })
})
