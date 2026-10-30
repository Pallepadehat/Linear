import type { WorkflowStatus } from '@linear/contract'

// Mirrors the server default (domain.md → Statuses) so the dialog shows what will be used.
// Becomes a team setting in LIN-49.
const DEFAULT_STATUS_NAME = 'Backlog'

/** `Backlog`, else the first `backlog` status, else the first `unstarted` one. */
export function defaultStatus(statuses: WorkflowStatus[]): WorkflowStatus | undefined {
  const sorted = [...statuses].sort((a, b) => a.position - b.position)
  return (
    sorted.find((s) => s.name === DEFAULT_STATUS_NAME) ??
    sorted.find((s) => s.category === 'backlog') ??
    sorted.find((s) => s.category === 'unstarted')
  )
}
