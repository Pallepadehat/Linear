import type { ProjectActivity } from '@linear/contract'
import { priorityLabel, toPriority } from '@/lib/priorities'
import { formatDay, toDay } from './project-dates'
import { projectStatusMeta } from './project-status'

/** Resolves lead ids to current member names (null when they're no longer a member). */
export type ProjectActivityNames = { member: (id: string) => string | undefined }

export type ProjectActivityLine = {
  /** Who did it; null for entries that read without an actor (a milestone completing). */
  actor: string | null
  text: string
  /** The issue an entry is about, shown as identifier + title after `text`. */
  issue?: { identifier: string; title: string }
}

const DATE_LABELS = { startDate: 'start date', targetDate: 'target date' } as const

export function projectActivityActor(entry: ProjectActivity): string {
  if (entry.actor) return entry.actor.name
  return entry.actorType === 'github' ? 'GitHub' : 'A removed user'
}

/** The sentence for one feed entry (docs/domain.md → Project activity). */
export function describeProjectActivity(
  entry: ProjectActivity,
  names: ProjectActivityNames,
): ProjectActivityLine {
  const actor = projectActivityActor(entry)
  const member = (id: string) => names.member(id) ?? 'a removed user'
  switch (entry.kind) {
    case 'project.created':
      return { actor, text: 'created the project' }
    case 'project.status_changed':
      return {
        actor,
        text: `changed status from ${projectStatusMeta(entry.payload.from).label} to ${projectStatusMeta(entry.payload.to).label}`,
      }
    case 'project.priority_changed': {
      const { from, to } = entry.payload
      if (to === 0) return { actor, text: 'removed priority' }
      const next = priorityLabel(toPriority(to))
      if (from === 0) return { actor, text: `set priority to ${next}` }
      return { actor, text: `changed priority from ${priorityLabel(toPriority(from))} to ${next}` }
    }
    case 'project.lead_changed': {
      const { to } = entry.payload
      return { actor, text: to ? `set lead to ${member(to)}` : 'removed the lead' }
    }
    case 'project.dates_changed': {
      const label = DATE_LABELS[entry.payload.field]
      const { from, to } = entry.payload
      if (!to) return { actor, text: `removed the ${label}` }
      if (!from) return { actor, text: `set the ${label} to ${formatDay(to)}` }
      return { actor, text: `changed the ${label} from ${formatDay(from)} to ${formatDay(to)}` }
    }
    case 'milestone.created':
      return { actor, text: `created milestone ${entry.payload.name}` }
    case 'milestone.completed':
      return { actor: null, text: `Milestone ${entry.payload.name} completed` }
    case 'project_update.posted':
      return { actor, text: 'posted a project update' }
    case 'project.issue_added':
      return { actor, text: 'added', issue: entry.payload }
    case 'project.issue_removed':
      return { actor, text: 'removed', issue: entry.payload }
  }
}

/** "Nov 3" (with the year outside the current one); the full timestamp goes in a tooltip. */
export function activityDay(date: Date, today: Date = new Date()): string {
  return formatDay(toDay(date), today)
}

/** What one feed row renders, so components don't take zod-inferred props. */
export function projectActivityRow(entry: ProjectActivity, names: ProjectActivityNames) {
  return {
    id: entry.id,
    line: describeProjectActivity(entry, names),
    avatarName: projectActivityActor(entry),
    avatarUrl: entry.actor?.avatarUrl ?? null,
    github: entry.actorType === 'github',
    at: entry.createdAt,
  }
}
