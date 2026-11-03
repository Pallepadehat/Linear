import type { Team, TeamWithStatuses } from '@linear/contract'
import { pickDefaultStatus } from '@linear/core'
import type { teams, workflowStatuses } from '@linear/db'

export function toTeamDto(row: typeof teams.$inferSelect): Team {
  return { id: row.id, name: row.name, key: row.key }
}

export function toTeamWithStatusesDto(
  row: typeof teams.$inferSelect,
  statuses: (typeof workflowStatuses.$inferSelect)[],
): TeamWithStatuses {
  const own = statuses
    .filter((s) => s.teamId === row.id)
    .map((s) => ({ id: s.id, name: s.name, category: s.category, position: s.position }))
  return {
    ...toTeamDto(row),
    statuses: own,
    defaultStatusId: pickDefaultStatus(own, row.defaultStatusId)?.id ?? null,
    defaultPriority: row.defaultPriority,
    defaultAssigneeId: row.defaultAssigneeId,
  }
}
