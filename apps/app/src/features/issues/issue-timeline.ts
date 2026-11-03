import type { Activity, CommentThread } from '@linear/contract'
import { priorityLabel, toPriority } from '@/lib/priorities'

export type TimelineEntry =
  | { type: 'comment'; key: string; at: Date; comment: CommentThread }
  | { type: 'activity'; key: string; at: Date; activity: Activity }

/**
 * Comment threads (placed by their root) and activity in one list, oldest first.
 * Ties keep ids in order (UUIDv7).
 */
export function buildTimeline(comments: CommentThread[], activity: Activity[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...comments.map((comment) => ({
      type: 'comment' as const,
      key: `comment:${comment.id}`,
      at: comment.createdAt,
      comment,
    })),
    ...activity.map((entry) => ({
      type: 'activity' as const,
      key: `activity:${entry.id}`,
      at: entry.createdAt,
      activity: entry,
    })),
  ]
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key))
}

/** Names for the ids an activity entry stores. Missing ids were deleted since. */
export type ActivityNames = {
  status: (id: string) => string | undefined
  user: (id: string) => string | undefined
  project: (id: string) => string | undefined
  label: (id: string) => string | undefined
}

export function activityActor(entry: Activity, names: ActivityNames): string {
  if (entry.actorType === 'github') return 'GitHub'
  return (entry.actorId && names.user(entry.actorId)) || 'Someone'
}

const asString = (value: Activity['from']) => (typeof value === 'string' ? value : null)
const asList = (value: Activity['from']) => (Array.isArray(value) ? value : [])

function joinNames(list: string[]) {
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

/** What happened, worded to follow the actor's name ("changed status from Todo to Done"). */
export function describeActivity(entry: Activity, names: ActivityNames): string {
  const name = (lookup: (id: string) => string | undefined, id: string | null, fallback: string) =>
    (id && lookup(id)) || fallback

  switch (entry.kind) {
    case 'created':
      return 'created the issue'
    case 'title':
      return `changed the title to "${asString(entry.to) ?? ''}"`
    case 'description':
      return 'updated the description'
    case 'status': {
      const from = name(names.status, asString(entry.from), 'a removed status')
      const to = name(names.status, asString(entry.to), 'a removed status')
      return `changed status from ${from} to ${to}`
    }
    case 'priority': {
      const to = toPriority(typeof entry.to === 'number' ? entry.to : 0)
      return to === 0 ? 'removed the priority' : `set priority to ${priorityLabel(to)}`
    }
    case 'assignee': {
      const to = asString(entry.to)
      if (to) return `assigned the issue to ${name(names.user, to, 'a removed user')}`
      const from = asString(entry.from)
      return from
        ? `unassigned ${name(names.user, from, 'a removed user')}`
        : 'removed the assignee'
    }
    case 'project': {
      const to = asString(entry.to)
      if (to) return `moved the issue to ${name(names.project, to, 'a removed project')}`
      return `removed the issue from ${name(names.project, asString(entry.from), 'its project')}`
    }
    case 'labels': {
      const from = asList(entry.from)
      const to = asList(entry.to)
      const labelNames = (ids: string[]) => ids.map((id) => names.label(id) ?? 'a removed label')
      const added = labelNames(to.filter((id) => !from.includes(id)))
      const removed = labelNames(from.filter((id) => !to.includes(id)))
      const parts = [
        added.length ? `added ${added.length === 1 ? 'label' : 'labels'} ${joinNames(added)}` : '',
        removed.length
          ? `removed ${removed.length === 1 ? 'label' : 'labels'} ${joinNames(removed)}`
          : '',
      ].filter(Boolean)
      return parts.join(' and ') || 'changed the labels'
    }
  }
}
