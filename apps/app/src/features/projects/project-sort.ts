import type { Project } from '@linear/contract'
import { healthRank } from './project-health'
import { PROJECT_STATUSES, progressPercent } from './project-status'

export const PROJECT_SORT_KEYS = [
  'name',
  'health',
  'priority',
  'lead',
  'targetDate',
  'issues',
  'status',
] as const
export type ProjectSortKey = (typeof PROJECT_SORT_KEYS)[number]
export type ProjectSort = { key: ProjectSortKey; direction: 'asc' | 'desc' }
export const DEFAULT_PROJECT_SORT: ProjectSort = { key: 'name', direction: 'asc' }

type Lookup = { leadName: (userId: string) => string | undefined }

const byName = (a: Project, b: Project) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/**
 * A comparable value per column, or null for "empty" (no health, priority, lead or date),
 * which sorts last in both directions like Linear.
 */
function sortValue(project: Project, key: ProjectSortKey, lookup: Lookup): string | number | null {
  switch (key) {
    case 'name':
      return project.name
    case 'health':
      // On track → Off track; projects without updates sort last.
      return healthRank(project.health)
    case 'priority':
      return project.priority === 0 ? null : project.priority
    case 'lead':
      return project.leadId ? (lookup.leadName(project.leadId) ?? null) : null
    case 'targetDate':
      return project.targetDate
    case 'issues':
      return project.issueCount
    case 'status':
      // Workflow order first (planned → canceled), then progress within a status.
      return (
        PROJECT_STATUSES.findIndex((s) => s.value === project.status) * 1000 +
        progressPercent(project.progress)
      )
  }
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
}

/** A sorted copy; ties (and the name column itself) fall back to the name, A → Z. */
export function sortProjects(projects: readonly Project[], sort: ProjectSort, lookup: Lookup) {
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...projects].sort((a, b) => {
    const left = sortValue(a, sort.key, lookup)
    const right = sortValue(b, sort.key, lookup)
    if (left === null || right === null) {
      if (left !== right) return left === null ? 1 : -1
      return byName(a, b)
    }
    return sign * compareValues(left, right) || byName(a, b)
  })
}

/** Clicking a header sorts by it ascending; clicking the active header flips the direction. */
export function toggleProjectSort(current: ProjectSort, key: ProjectSortKey): ProjectSort {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

export function isProjectSort(value: unknown): value is ProjectSort {
  if (typeof value !== 'object' || value === null) return false
  const { key, direction } = value as Record<string, unknown>
  return PROJECT_SORT_KEYS.some((k) => k === key) && (direction === 'asc' || direction === 'desc')
}
