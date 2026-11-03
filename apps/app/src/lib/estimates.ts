import type { EstimateScale as ContractEstimateScale } from '@linear/contract'

/**
 * Spelled out (and checked against the contract below) because Vue's SFC compiler
 * can't resolve zod-inferred types in `defineProps`.
 */
export type EstimateScale = 'off' | 'linear' | 'fibonacci' | 'exponential' | 'tshirt'
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const _scalesMatch: Same<EstimateScale, ContractEstimateScale> = true
void _scalesMatch

// docs/domain.md → Estimates. Mirrors packages/core/src/issues/estimates.ts.
const SCALE_VALUES: Record<EstimateScale, readonly number[]> = {
  off: [],
  linear: [1, 2, 3, 4, 5],
  fibonacci: [1, 2, 3, 5, 8],
  exponential: [1, 2, 4, 8, 16],
  tshirt: [1, 2, 3, 5, 8],
}

// T-shirt sizes are stored as points so they sum.
const TSHIRT_SIZES = new Map([
  [1, 'XS'],
  [2, 'S'],
  [3, 'M'],
  [5, 'L'],
  [8, 'XL'],
])

export type EstimateSettings = { scale: EstimateScale; allowZero: boolean }

export const ESTIMATE_SCALES: { value: EstimateScale; label: string }[] = [
  { value: 'off', label: 'Not in use' },
  { value: 'linear', label: 'Linear' },
  { value: 'fibonacci', label: 'Fibonacci' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'tshirt', label: 'T-shirt' },
]

/** The values a team may pick, ascending; zero first only when allowed. */
export function estimateValues({ scale, allowZero }: EstimateSettings): number[] {
  const values = SCALE_VALUES[scale]
  if (values.length === 0) return []
  return allowZero ? [0, ...values] : [...values]
}

/** "1 Point", "3 Points", "M". Values not on the scale (after a scale change) show as the raw number. */
export function estimateLabel(value: number, scale: EstimateScale): string {
  if (scale === 'tshirt') return TSHIRT_SIZES.get(value) ?? String(value)
  if (!SCALE_VALUES[scale].includes(value) && value !== 0) return String(value)
  return `${value} ${value === 1 ? 'Point' : 'Points'}`
}

/** The compact form for chips: "3" or "M". */
export function estimateShortLabel(value: number, scale: EstimateScale): string {
  return scale === 'tshirt' ? (TSHIRT_SIZES.get(value) ?? String(value)) : String(value)
}

/** The scale's values as a preview, e.g. "1, 2, 3, 5, 8" or "XS, S, M, L, XL". */
export function scalePreview(settings: EstimateSettings): string {
  return estimateValues(settings)
    .map((value) => estimateShortLabel(value, settings.scale))
    .join(', ')
}

/** Total points of the issues whose team uses estimates; teams with them off don't count. */
export function sumEstimates(
  issues: { teamId: string; estimate: number | null }[],
  scaleOf: (teamId: string) => EstimateScale | undefined,
): number {
  let total = 0
  for (const issue of issues) {
    const scale = scaleOf(issue.teamId)
    if (issue.estimate !== null && scale && scale !== 'off') total += issue.estimate
  }
  return total
}

export const pointsText = (value: number) => `${value} ${value === 1 ? 'point' : 'points'}`
