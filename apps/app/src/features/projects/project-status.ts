import type { ProjectProgress, ProjectStatus, StatusCategory } from '@linear/contract'

// domain.md → Projects. The icon reuses the issue status glyphs so both read the same way.
export const PROJECT_STATUSES: { value: ProjectStatus; label: string; icon: StatusCategory }[] = [
  { value: 'planned', label: 'Planned', icon: 'unstarted' },
  { value: 'in_progress', label: 'In Progress', icon: 'started' },
  { value: 'completed', label: 'Completed', icon: 'completed' },
  { value: 'canceled', label: 'Canceled', icon: 'canceled' },
]

export function projectStatusMeta(status: ProjectStatus) {
  return PROJECT_STATUSES.find((s) => s.value === status) ?? PROJECT_STATUSES[0]!
}

/** Whole-number percentage of completed issues; 0 for an empty project. */
export function progressPercent({ completed, total }: ProjectProgress): number {
  if (total <= 0) return 0
  return Math.round((Math.min(completed, total) / total) * 100)
}
