import type { StatusCategory } from '@linear/db'

/**
 * `completedAt` after moving into a status of `category`: set on entering
 * `completed`, kept while staying there, cleared on leaving (docs/domain.md → Statuses).
 */
export function nextCompletedAt(
  category: StatusCategory,
  current: Date | null,
  now: Date = new Date(),
): Date | null {
  if (category !== 'completed') return null
  return current ?? now
}
