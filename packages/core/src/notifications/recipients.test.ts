import { describe, expect, it } from 'vitest'
import { notificationSummary, recipientsFor } from './recipients'

const [ada, bob, cy, outsider] = ['ada', 'bob', 'cy', 'outsider']
const members = new Set([ada, bob, cy])

describe('recipientsFor', () => {
  it('never notifies the actor', () => {
    expect(recipientsFor({ type: 'commented' }, [ada, bob, cy], ada, members)).toEqual([bob, cy])
    expect(recipientsFor({ type: 'assigned', assigneeId: ada }, [bob], ada, members)).toEqual([])
    expect(recipientsFor({ type: 'mentioned', userIds: [ada, bob] }, [], ada, members)).toEqual([
      bob,
    ])
  })

  it('de-duplicates recipients', () => {
    expect(recipientsFor({ type: 'status_changed' }, [bob, cy, bob], ada, members)).toEqual([
      bob,
      cy,
    ])
    expect(
      recipientsFor({ type: 'mentioned', userIds: [bob, bob, cy] }, [], null, members),
    ).toEqual([bob, cy])
  })

  it('excludes users who are not workspace members', () => {
    expect(recipientsFor({ type: 'pr_linked' }, [bob, outsider], null, members)).toEqual([bob])
    expect(recipientsFor({ type: 'assigned', assigneeId: outsider }, [], ada, members)).toEqual([])
    expect(
      recipientsFor(
        { type: 'issue_created_in_team', teamMemberIds: [outsider, cy] },
        [],
        ada,
        members,
      ),
    ).toEqual([cy])
  })

  it('sends targeted events to their targets, not the subscribers', () => {
    expect(recipientsFor({ type: 'assigned', assigneeId: cy }, [bob], ada, members)).toEqual([cy])
    expect(
      recipientsFor({ type: 'issue_created_in_team', teamMemberIds: [bob] }, [cy], ada, members),
    ).toEqual([bob])
  })

  it('keeps everyone for GitHub automation (no actor)', () => {
    expect(recipientsFor({ type: 'status_changed' }, [ada, bob], null, members)).toEqual([ada, bob])
  })
})

describe('notificationSummary', () => {
  it('names the actor, GitHub, or someone deleted', () => {
    const user = { actorType: 'user' as const, actorName: 'Ada' }
    expect(notificationSummary({ ...user, type: 'assigned' })).toBe('Ada assigned you')
    expect(notificationSummary({ ...user, type: 'commented' })).toBe('Ada commented')
    expect(notificationSummary({ ...user, type: 'mentioned' })).toBe('Ada mentioned you')
    expect(notificationSummary({ ...user, type: 'issue_created_in_team' })).toBe(
      'Ada created the issue',
    )
    expect(
      notificationSummary({
        actorType: 'github',
        actorName: null,
        type: 'status_changed',
        toStatusName: 'Done',
      }),
    ).toBe('GitHub changed status to Done')
    expect(
      notificationSummary({ actorType: 'user', actorName: null, type: 'status_changed' }),
    ).toBe('Someone changed status')
    expect(
      notificationSummary({
        actorType: 'github',
        actorName: null,
        type: 'pr_linked',
        pullRequestNumber: 12,
      }),
    ).toBe('GitHub linked PR #12')
  })
})
