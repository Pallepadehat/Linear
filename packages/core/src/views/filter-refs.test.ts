import { describe, expect, it } from 'vitest'
import { collectFilterRefs } from './filter-refs'

describe('collectFilterRefs', () => {
  it('groups ids by what they must be, skipping null and me', () => {
    expect(
      collectFilterRefs({
        statusIds: ['s1'],
        statusIdsNot: ['s2', 's1'],
        assigneeIds: ['u1', null],
        subscriberIds: ['me', 'u2'],
        creatorIds: ['u1'],
        projectIds: [null, 'p1'],
        milestoneIds: ['m1', null],
        cycleIds: ['c1'],
        labelIds: ['l1'],
        priorities: [1],
        q: 'x',
      }),
    ).toEqual({
      status: ['s1', 's2'],
      member: ['u1', 'u2'],
      project: ['p1'],
      milestone: ['m1'],
      cycle: ['c1'],
      label: ['l1'],
    })
  })

  it('refuses an id filter it has no check for', () => {
    expect(() => collectFilterRefs({ sprintIds: ['s1'] })).toThrow(/sprintIds/)
  })
})
