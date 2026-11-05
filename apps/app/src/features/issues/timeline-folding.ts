import type { Activity } from '@linear/contract'
import type { TimelineEntry } from './issue-timeline'

/** What the Activity section shows (Activity header → filter menu). */
export const ACTIVITY_FILTERS = ['all', 'comments', 'history'] as const
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]
export const ACTIVITY_FILTER_LABELS: Record<ActivityFilter, string> = {
  all: 'All activity',
  comments: 'Comments only',
  history: 'History only',
}
export const isActivityFilter = (value: unknown): value is ActivityFilter =>
  ACTIVITY_FILTERS.includes(value as ActivityFilter)

export function filterTimeline(entries: TimelineEntry[], filter: ActivityFilter) {
  if (filter === 'all') return entries
  const type = filter === 'comments' ? 'comment' : 'activity'
  return entries.filter((e) => e.type === type)
}

/** Changes that net out: the latest value replaces the earlier ones when merged. */
const MERGEABLE = new Set<Activity['kind']>([
  'title',
  'description',
  'status',
  'priority',
  'estimate',
  'assignee',
  'due_date',
  'labels',
  'project',
  'cycle',
])
export const MERGE_WINDOW_MS = 5 * 60 * 1000

const sameActor = (a: Activity, b: Activity) =>
  a.actorType === b.actorType && a.actorId === b.actorId && a.pullRequestId === b.pullRequestId

function sameValue(from: Activity['from'], to: Activity['to']) {
  if (Array.isArray(from) && Array.isArray(to))
    return from.length === to.length && [...from].sort().join() === [...to].sort().join()
  return from === to
}

/**
 * Back-to-back changes of the same kind by the same actor, each within `windowMs` of the
 * previous one, become one entry from the first `from` to the last `to` ("added labels
 * A, B and C", only the final title). A merge that nets out to no change is dropped.
 */
export function mergeActivity(entries: TimelineEntry[], windowMs = MERGE_WINDOW_MS) {
  const out: TimelineEntry[] = []
  for (const entry of entries) {
    const previous = out.at(-1)
    if (
      entry.type === 'activity' &&
      previous?.type === 'activity' &&
      MERGEABLE.has(entry.activity.kind) &&
      previous.activity.kind === entry.activity.kind &&
      sameActor(previous.activity, entry.activity) &&
      entry.at.getTime() - previous.at.getTime() <= windowMs
    ) {
      out[out.length - 1] = {
        ...entry,
        activity: { ...entry.activity, from: previous.activity.from },
        merged: (previous.merged ?? 1) + 1,
      }
      continue
    }
    out.push(entry)
  }
  return out.filter(
    (e) =>
      e.type !== 'activity' ||
      !e.merged ||
      e.activity.kind === 'description' ||
      !sameValue(e.activity.from, e.activity.to),
  )
}

/** A folded stretch of the timeline, shown as a "Show N more" button. */
export type TimelineFold = { type: 'fold'; key: string; reason: 'older' | 'run'; count: number }
export type TimelineItem = TimelineEntry | TimelineFold

export const OLDER_FOLD_KEY = 'fold:older'

export type FoldOptions = {
  /** Folds the user opened (`TimelineFold.key`). */
  expanded: ReadonlySet<string>
  /** Runs of more history entries than this fold their middle. */
  runLimit?: number
  /** Entries kept below the "older" fold, so the page opens near the latest activity. */
  keepRecent?: number
}

/**
 * Folds a long timeline: everything but the first entry and the `keepRecent` latest goes
 * behind "Show N older activities", and in what's left a run of more than `runLimit`
 * history entries in a row (no comment in between) shows only its first and last entry
 * around "Show N more events". Folds hide at least 2 entries, else they aren't worth it.
 */
export function foldTimeline(
  entries: TimelineEntry[],
  { expanded, runLimit = 4, keepRecent = 10 }: FoldOptions,
): TimelineItem[] {
  let items: TimelineItem[] = entries
  const olderCount = entries.length - 1 - keepRecent
  if (olderCount >= 2 && !expanded.has(OLDER_FOLD_KEY)) {
    items = [
      entries[0]!,
      { type: 'fold', key: OLDER_FOLD_KEY, reason: 'older', count: olderCount },
      ...entries.slice(-keepRecent),
    ]
  }

  const out: TimelineItem[] = []
  let run: TimelineEntry[] = []
  const flush = () => {
    const key = run[1] ? `fold:${run[1].key}` : ''
    if (run.length > runLimit && run.length - 2 >= 2 && !expanded.has(key)) {
      out.push(run[0]!, { type: 'fold', key, reason: 'run', count: run.length - 2 }, run.at(-1)!)
    } else out.push(...run)
    run = []
  }
  for (const item of items) {
    if (item.type === 'activity') {
      run.push(item)
      continue
    }
    flush()
    out.push(item)
  }
  flush()
  return out
}

/** Every fold key in `items`, for "Expand all". */
export const foldKeys = (items: TimelineItem[]) =>
  items.flatMap((item) => (item.type === 'fold' ? [item.key] : []))
