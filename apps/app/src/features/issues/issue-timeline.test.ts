import type { Activity, CommentThread } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import {
  activityActor,
  buildTimeline,
  describeActivity,
  type ActivityNames,
} from './issue-timeline'

const issueId = crypto.randomUUID()

function activity(
  kind: Activity['kind'],
  from: Activity['from'] = null,
  to: Activity['to'] = null,
  at = new Date('2026-11-01T10:00:00Z'),
): Activity {
  return {
    id: crypto.randomUUID(),
    issueId,
    actorType: 'user',
    actorId: 'u1',
    pullRequestId: null,
    kind,
    from,
    to,
    createdAt: at,
  }
}

function comment(body: string, at: Date): CommentThread {
  return {
    id: crypto.randomUUID(),
    issueId,
    parentId: null,
    author: { id: crypto.randomUUID(), name: 'Ada', avatarUrl: null },
    body,
    reactions: [],
    resolvedAt: null,
    createdAt: at,
    updatedAt: at,
    replies: [],
    replyCount: 0,
  }
}

const table: Record<string, string> = {
  s1: 'Todo',
  s2: 'In Progress',
  u1: 'Ada Lovelace',
  u2: 'Grace Hopper',
  p1: 'Launch',
  l1: 'Bug',
  l2: 'Frontend',
  l3: 'Docs',
}
const lookup = (id: string) => table[id]
const names: ActivityNames = { status: lookup, user: lookup, project: lookup, label: lookup }

describe('buildTimeline', () => {
  it('merges comments and activity oldest first', () => {
    const created = activity('created', null, null, new Date('2026-11-01T09:00:00Z'))
    const status = activity('status', 's1', 's2', new Date('2026-11-01T11:00:00Z'))
    const note = comment('hi', new Date('2026-11-01T10:00:00Z'))

    const timeline = buildTimeline([note], [status, created])

    expect(timeline.map((e) => e.type)).toEqual(['activity', 'comment', 'activity'])
    expect(timeline[0]?.key).toBe(`activity:${created.id}`)
    expect(timeline[2]?.key).toBe(`activity:${status.id}`)
  })
})

describe('activityActor', () => {
  it('names the user, GitHub, or a fallback', () => {
    expect(activityActor(activity('created'), names)).toBe('Ada Lovelace')
    expect(
      activityActor({ ...activity('status'), actorType: 'github', actorId: null }, names),
    ).toBe('GitHub')
    expect(activityActor({ ...activity('created'), actorId: null }, names)).toBe('Someone')
  })
})

describe('describeActivity', () => {
  it.each([
    [activity('created'), 'created the issue'],
    [activity('title', 'Old', 'New'), 'changed the title to "New"'],
    [activity('description'), 'updated the description'],
    [activity('status', 's1', 's2'), 'changed status from Todo to In Progress'],
    [activity('status', 'gone', 's2'), 'changed status from a removed status to In Progress'],
    [activity('priority', 0, 2), 'set priority to High'],
    [activity('priority', 2, 0), 'removed the priority'],
    [activity('assignee', null, 'u2'), 'assigned the issue to Grace Hopper'],
    [activity('assignee', 'u2', null), 'unassigned Grace Hopper'],
    [activity('project', null, 'p1'), 'moved the issue to Launch'],
    [activity('project', 'p1', null), 'removed the issue from Launch'],
    [activity('labels', [], ['l1']), 'added label Bug'],
    [activity('relation', null, ['blocks', 'i9', 'TIP-9']), 'marked as blocking TIP-9'],
    [activity('relation', null, ['blocked_by', 'i4', 'TIP-4']), 'marked as blocked by TIP-4'],
    [activity('relation', null, ['duplicate_of', 'i2', 'TIP-2']), 'marked as a duplicate of TIP-2'],
    [activity('relation', ['related', 'i3', 'TIP-3'], null), 'removed the relation with TIP-3'],
    [
      activity('labels', ['l1'], ['l2', 'l3']),
      'added labels Frontend and Docs and removed label Bug',
    ],
    [activity('labels', ['l1', 'l2', 'l3'], []), 'removed labels Bug, Frontend and Docs'],
    [activity('estimate', null, 3), 'set estimate to 3 points'],
    [activity('estimate', 3, 1), 'set estimate to 1 point'],
    [activity('estimate', 3, null), 'removed estimate'],
    [activity('parent', null, 'TIP-12'), 'set parent to TIP-12'],
    [activity('parent', 'TIP-12', null), 'removed parent'],
    [activity('sub_issue', null, 'TIP-15'), 'added sub-issue TIP-15'],
    [activity('sub_issue', 'TIP-15', null), 'removed sub-issue TIP-15'],
    [activity('due_date', null, `${new Date().getFullYear()}-11-07`), 'set due date to Nov 7'],
    [activity('due_date', '2026-11-07', null), 'removed due date'],
  ])('%#: %s', (entry, expected) => {
    expect(describeActivity(entry, names)).toBe(expected)
  })

  it('names estimates the way the team does', () => {
    expect(describeActivity(activity('estimate', null, 3), { ...names, estimate: () => 'M' })).toBe(
      'set estimate to M',
    )
  })
})
