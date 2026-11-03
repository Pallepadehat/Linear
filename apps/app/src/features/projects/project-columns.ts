import type { ProjectSortKey } from './project-sort'

/** Column headers of the projects table, also used as the Display menu's sort options. */
export const PROJECT_COLUMN_LABELS: Record<ProjectSortKey, string> = {
  name: 'Name',
  health: 'Health',
  priority: 'Priority',
  lead: 'Lead',
  targetDate: 'Target date',
  issues: 'Issues',
  status: 'Status',
}
