import type { WorkflowStatus } from '@linear/contract'

/** Mirrors the server default (domain.md → Statuses): `Todo`, else the first `unstarted` status. */
export function defaultStatus(statuses: WorkflowStatus[]): WorkflowStatus | undefined {
  const unstarted = statuses
    .filter((s) => s.category === 'unstarted')
    .sort((a, b) => a.position - b.position)
  return unstarted.find((s) => s.name === 'Todo') ?? unstarted[0]
}
