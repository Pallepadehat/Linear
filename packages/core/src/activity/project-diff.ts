import type { ProjectActivityEvent, projects } from '@linear/db'

/** The project fields whose changes are written to the project feed. */
export type ProjectSnapshot = Pick<
  typeof projects.$inferSelect,
  'status' | 'priority' | 'leadId' | 'startDate' | 'targetDate'
>

/**
 * One event per tracked field in `next` whose value differs from `current`; a field
 * set to the value it already had writes nothing. Each date field is its own event.
 */
export function diffProject(
  current: ProjectSnapshot,
  next: Partial<ProjectSnapshot>,
): ProjectActivityEvent[] {
  const events: ProjectActivityEvent[] = []
  if (next.status !== undefined && next.status !== current.status)
    events.push({
      kind: 'project.status_changed',
      payload: { from: current.status, to: next.status },
    })
  if (next.priority !== undefined && next.priority !== current.priority)
    events.push({
      kind: 'project.priority_changed',
      payload: { from: current.priority, to: next.priority },
    })
  if (next.leadId !== undefined && next.leadId !== current.leadId)
    events.push({
      kind: 'project.lead_changed',
      payload: { from: current.leadId, to: next.leadId },
    })
  for (const field of ['startDate', 'targetDate'] as const) {
    const to = next[field]
    if (to !== undefined && to !== current[field])
      events.push({ kind: 'project.dates_changed', payload: { field, from: current[field], to } })
  }
  return events
}

type IssueRef = { issueId: string; identifier: string; title: string }

/**
 * Moving an issue between projects is a removal from the old one and an addition to
 * the new one; an unchanged project writes nothing.
 */
export function issueProjectEvents(
  from: string | null,
  to: string | null,
  issue: IssueRef,
): { projectId: string; event: ProjectActivityEvent }[] {
  if (from === to) return []
  const events: { projectId: string; event: ProjectActivityEvent }[] = []
  if (from)
    events.push({ projectId: from, event: { kind: 'project.issue_removed', payload: issue } })
  if (to) events.push({ projectId: to, event: { kind: 'project.issue_added', payload: issue } })
  return events
}

export type MilestoneProgress = { completed: number; total: number }

/**
 * Whether an issue change completed a milestone: every issue is done now and wasn't
 * before. An empty milestone is never completed, and a milestone that already was
 * (another done issue edited, or one added and removed again) doesn't fire twice.
 * Wired up by the milestone feature (docs/domain.md → Project activity).
 */
export function completesMilestone(before: MilestoneProgress, after: MilestoneProgress) {
  const done = (p: MilestoneProgress) => p.total > 0 && p.completed === p.total
  return done(after) && !done(before)
}
