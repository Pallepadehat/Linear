import { DomainError } from '../../errors'
import { mergeFavoriteOrder } from '../../favorites/reorder'

/** Issue counts of one milestone: every issue in the total, `completed` ones in `doneCount`. */
export type MilestoneCounts = { issueCount: number; doneCount: number }

/** Done / total as a fraction from 0 to 1; 0 for a milestone without issues. */
export function milestoneProgress({ issueCount, doneCount }: MilestoneCounts): number {
  return issueCount === 0 ? 0 : doneCount / issueCount
}

/** Complete once it has issues and all of them are done; an empty milestone is not complete. */
export function isMilestoneComplete({ issueCount, doneCount }: MilestoneCounts): boolean {
  return issueCount > 0 && doneCount === issueCount
}

/** The project's current milestone: the first, in order, that isn't complete. */
export function currentMilestoneOf<T extends MilestoneCounts>(ordered: T[]): T | null {
  return ordered.find((milestone) => !isMilestoneComplete(milestone)) ?? null
}

/**
 * The full order after a reorder: the requested ids first, then any milestone the request
 * didn't mention (added from another tab) in its current order. Unknown or repeated ids → null.
 */
export function mergeMilestoneOrder(currentIds: string[], requestedIds: string[]) {
  return mergeFavoriteOrder(currentIds, requestedIds)
}

/** An issue's milestone must belong to the issue's project (docs/domain.md → Project milestones). */
export function assertMilestoneInProject(
  milestone: { projectId: string } | undefined,
  projectId: string | null,
) {
  if (!projectId) throw new DomainError('BAD_REQUEST', 'Set a project before choosing a milestone')
  if (!milestone || milestone.projectId !== projectId)
    throw new DomainError('BAD_REQUEST', "Milestone does not belong to the issue's project")
}

/**
 * The milestone an issue update writes: the requested one, `null` when the project changes
 * or is cleared without a new milestone, or `undefined` to leave it as it is. The caller still
 * checks a requested milestone against `projectId` (the project the issue ends up in).
 */
export function nextIssueMilestone(
  current: { projectId: string | null; milestoneId: string | null },
  input: { projectId?: string | null; milestoneId?: string | null },
): { milestoneId: string | null | undefined; projectId: string | null } {
  const projectId = input.projectId === undefined ? current.projectId : input.projectId
  if (input.milestoneId !== undefined) return { milestoneId: input.milestoneId, projectId }
  const projectChanged = input.projectId !== undefined && input.projectId !== current.projectId
  return { milestoneId: projectChanged && current.milestoneId ? null : undefined, projectId }
}
