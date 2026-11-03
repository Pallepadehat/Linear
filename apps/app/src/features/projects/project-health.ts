import type { ProjectHealth } from '@linear/contract'

// domain.md → Project updates; colors per docs/design.md → Color in the product.
export const PROJECT_HEALTHS: { value: ProjectHealth; label: string }[] = [
  { value: 'on_track', label: 'On track' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'off_track', label: 'Off track' },
]

/** "On track" / "At risk" / "Off track", or "No updates" before the first update. */
export function healthLabel(health: ProjectHealth | null): string {
  return PROJECT_HEALTHS.find((h) => h.value === health)?.label ?? 'No updates'
}

/** Best first (On track → Off track), for sorting; null when there is no health yet. */
export function healthRank(health: ProjectHealth | null): number | null {
  const index = PROJECT_HEALTHS.findIndex((h) => h.value === health)
  return index === -1 ? null : index
}
