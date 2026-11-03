import { listCycleTeamIds, maintainTeamCycles } from '@linear/core'
import type { JobDeps } from '../../deps'

/**
 * Hourly cycle upkeep for every team with cycles on (docs/domain.md → Cycles).
 * Each team is its own transaction, so one failing team doesn't block the rest;
 * the job then fails and is retried, and the per-team work is idempotent.
 */
export async function cyclesMaintain(deps: JobDeps, now = new Date()) {
  let failed = 0
  for (const teamId of await listCycleTeamIds(deps.db)) {
    let result
    try {
      result = await maintainTeamCycles(deps.db, teamId, now)
    } catch (err) {
      failed++
      deps.logger.error({ teamId, err }, 'cycles-maintain: team failed')
      continue
    }
    if (!result) continue
    for (const issueId of result.movedIssueIds) {
      try {
        await deps.publish(result.workspaceId, {
          type: 'issue.updated',
          issueId,
          fields: ['cycle'],
          actorId: null,
          originId: null,
        })
      } catch (err) {
        // Best effort (docs/domain.md → Realtime events): never undo the rollover.
        deps.logger.warn({ issueId, err }, 'cycles-maintain: publish failed')
      }
    }
    if (result.created || result.closed || result.movedIssueIds.length) {
      deps.logger.info(
        {
          teamId,
          created: result.created,
          closed: result.closed,
          moved: result.movedIssueIds.length,
        },
        'cycles-maintain: team updated',
      )
    }
  }
  if (failed) throw new Error(`cycles-maintain: ${failed} team(s) failed`)
}
