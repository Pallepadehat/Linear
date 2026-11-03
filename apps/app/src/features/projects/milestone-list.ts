import type { Milestone } from '@linear/contract'

/** Whole percent for display, like project progress. */
export const milestonePercent = (milestone: Pick<Milestone, 'progress'>) =>
  Math.round(milestone.progress * 100)

/** The list with `id` moved to `toIndex`, renumbered as the server will store it. */
export function moveMilestone(list: Milestone[], id: string, toIndex: number): Milestone[] {
  const from = list.findIndex((m) => m.id === id)
  if (from < 0 || toIndex < 0 || toIndex >= list.length || from === toIndex) return list
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(toIndex, 0, moved!)
  return next.map((m, sortOrder) => ({ ...m, sortOrder }))
}
