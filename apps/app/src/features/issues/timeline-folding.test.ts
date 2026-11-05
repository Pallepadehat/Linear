import type { Activity, CommentThread } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import type { TimelineEntry } from './issue-timeline'
import {
  filterTimeline,
  foldTimeline,
  mergeActivity,
  OLDER_FOLD_KEY,
  type TimelineItem,
} from './timeline-folding'

const ALICE = '00000000-0000-7000-8000-00000000000a'
const BOB = '00000000-0000-7000-8000-00000000000b'
const T0 = new Date('2026-11-01T10:00:00Z').getTime()
let seq = 0

function activity(
  kind: Activity['kind'],
  from: Activity['from'],
  to: Activity['to'],
  { minutes = seq, actor = ALICE }: { minutes?: number; actor?: string } = {},
): TimelineEntry {
  const id = `a${seq++}`
  const at = new Date(T0 + minutes * 60_000)
  return {
    type: 'activity',
    key: `activity:${id}`,
    at,
    activity: {
      id,
      issueId: 'i',
      actorType: 'user',
      actorId: actor,
      pullRequestId: null,
      kind,
      from,
      to,
      mentionedIn: null,
      createdAt: at,
    },
  }
}

function comment(minutes: number): TimelineEntry {
  const id = `c${seq++}`
  const at = new Date(T0 + minutes * 60_000)
  return {
    type: 'comment',
    key: `comment:${id}`,
    at,
    comment: { id, createdAt: at } as unknown as CommentThread,
  }
}

const shape = (items: TimelineItem[]) =>
  items.map((i) => (i.type === 'fold' ? `fold(${i.reason}:${i.count})` : i.type))

describe('filterTimeline', () => {
  const entries = [activity('created', null, null), comment(1), activity('title', 'a', 'b')]
  it('keeps everything, only comments or only history', () => {
    expect(filterTimeline(entries, 'all')).toBe(entries)
    expect(shape(filterTimeline(entries, 'comments'))).toEqual(['comment'])
    expect(shape(filterTimeline(entries, 'history'))).toEqual(['activity', 'activity'])
  })
})

describe('mergeActivity', () => {
  it('combines back-to-back label changes into the net change', () => {
    const merged = mergeActivity([
      activity('labels', [], ['x'], { minutes: 0 }),
      activity('labels', ['x'], ['x', 'y'], { minutes: 1 }),
      activity('labels', ['x', 'y'], ['x', 'y', 'z'], { minutes: 2 }),
    ])
    expect(merged).toHaveLength(1)
    const [entry] = merged
    expect(entry?.type === 'activity' && entry.activity.from).toEqual([])
    expect(entry?.type === 'activity' && entry.activity.to).toEqual(['x', 'y', 'z'])
    expect(entry?.type === 'activity' && entry.merged).toBe(3)
  })

  it('keeps only the latest title', () => {
    const merged = mergeActivity([
      activity('title', 'a', 'b', { minutes: 0 }),
      activity('title', 'b', 'c', { minutes: 3 }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.type === 'activity' && merged[0].activity.to).toBe('c')
  })

  it('splits on another actor, another kind, a comment or a gap over the window', () => {
    expect(
      mergeActivity([
        activity('title', 'a', 'b', { minutes: 0 }),
        activity('title', 'b', 'c', { minutes: 1, actor: BOB }),
        activity('status', 's1', 's2', { minutes: 2, actor: BOB }),
        comment(3),
        activity('status', 's2', 's3', { minutes: 4, actor: BOB }),
        activity('status', 's3', 's4', { minutes: 20, actor: BOB }),
      ]),
    ).toHaveLength(6)
  })

  it('drops a merge that nets out to nothing', () => {
    expect(
      mergeActivity([
        activity('labels', [], ['x'], { minutes: 0 }),
        activity('labels', ['x'], [], { minutes: 1 }),
      ]),
    ).toEqual([])
  })
})

describe('foldTimeline', () => {
  const run = (n: number, start = 0) =>
    Array.from({ length: n }, (_, i) => activity('title', 'a', 'b', { minutes: start + i }))

  it('folds the middle of a long history run', () => {
    const items = foldTimeline([comment(0), ...run(6, 1), comment(10)], {
      expanded: new Set(),
    })
    expect(shape(items)).toEqual(['comment', 'activity', 'fold(run:4)', 'activity', 'comment'])
  })

  it('leaves short runs and opened folds alone', () => {
    const entries = run(4)
    expect(foldTimeline(entries, { expanded: new Set() })).toEqual(entries)
    const long = run(6)
    const key = foldTimeline(long, { expanded: new Set() }).find((i) => i.type === 'fold')!.key
    expect(foldTimeline(long, { expanded: new Set([key]) })).toHaveLength(6)
  })

  it('folds older entries, keeping the first and the latest', () => {
    const entries = [
      activity('created', null, null),
      ...Array.from({ length: 14 }, (_, i) => comment(i + 1)),
    ]
    const items = foldTimeline(entries, { expanded: new Set(), keepRecent: 10 })
    expect(shape(items)).toEqual(['activity', 'fold(older:4)', ...Array(10).fill('comment')])
    expect(foldTimeline(entries, { expanded: new Set([OLDER_FOLD_KEY]) })).toHaveLength(15)
  })
})
