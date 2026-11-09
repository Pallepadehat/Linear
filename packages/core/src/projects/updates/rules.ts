import type { projectHealth } from '@linear/db'

export type ProjectHealthValue = (typeof projectHealth.enumValues)[number]

type UpdateRef = { id: string; projectId: string; health: ProjectHealthValue; createdAt: Date }

export type ProjectHealthSummary = { health: ProjectHealthValue | null; lastUpdateAt: Date | null }

export const NO_HEALTH: ProjectHealthSummary = { health: null, lastUpdateAt: null }

/** Newest first: later `createdAt`, then the larger (UUIDv7, time-ordered) id breaks ties. */
export function compareUpdatesNewestFirst(a: UpdateRef, b: UpdateRef) {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime()
  if (byTime !== 0) return byTime
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/** A project's health is its latest update's health; null when it has none (docs/domain.md). */
export function projectHealthOf(updates: readonly UpdateRef[]): ProjectHealthSummary {
  const [latest] = [...updates].sort(compareUpdatesNewestFirst)
  return latest ? { health: latest.health, lastUpdateAt: latest.createdAt } : NO_HEALTH
}

/** Health per project from updates of any number of projects, in any order. */
export function healthByProject(updates: readonly UpdateRef[]) {
  const grouped = new Map<string, UpdateRef[]>()
  for (const update of updates) {
    const list = grouped.get(update.projectId) ?? []
    list.push(update)
    grouped.set(update.projectId, list)
  }
  return new Map([...grouped].map(([projectId, list]) => [projectId, projectHealthOf(list)]))
}
