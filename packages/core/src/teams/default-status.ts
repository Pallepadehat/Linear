type StatusLike = { id: string; name: string; category: string; position: number }

const FALLBACK_STATUS_NAME = 'Backlog'

/**
 * The status a new issue gets when none is given (docs/domain.md → Team issue defaults):
 * the team's configured default, else `Backlog`, else the first `backlog` status,
 * else the first `unstarted` one.
 */
export function pickDefaultStatus<S extends StatusLike>(
  statuses: readonly S[],
  defaultStatusId: string | null,
): S | undefined {
  const configured = defaultStatusId ? statuses.find((s) => s.id === defaultStatusId) : undefined
  if (configured) return configured
  const sorted = [...statuses].sort((a, b) => a.position - b.position)
  return (
    sorted.find((s) => s.name === FALLBACK_STATUS_NAME) ??
    sorted.find((s) => s.category === 'backlog') ??
    sorted.find((s) => s.category === 'unstarted')
  )
}
