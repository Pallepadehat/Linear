import type { statusCategory } from './schema'

export type StatusCategory = (typeof statusCategory.enumValues)[number]

/** Statuses every new team starts with (docs/domain.md → Statuses). */
export const DEFAULT_WORKFLOW_STATUSES: ReadonlyArray<{ name: string; category: StatusCategory }> =
  [
    { name: 'Backlog', category: 'backlog' },
    { name: 'Todo', category: 'unstarted' },
    { name: 'In Progress', category: 'started' },
    { name: 'Done', category: 'completed' },
    { name: 'Canceled', category: 'canceled' },
  ]
