import type { estimateScale } from '@linear/db'
import { DomainError } from '../errors'

export type EstimateScale = (typeof estimateScale.enumValues)[number]

/**
 * Points each scale offers, before the zero rule (docs/domain.md → Estimates).
 * T-shirt sizes XS–XL are stored as 1, 2, 3, 5, 8 so they sum like points.
 */
const SCALE_VALUES: Record<EstimateScale, readonly number[]> = {
  off: [],
  linear: [1, 2, 3, 4, 5],
  fibonacci: [1, 2, 3, 5, 8],
  exponential: [1, 2, 4, 8, 16],
  tshirt: [1, 2, 3, 5, 8],
}

/** The values a team may pick, ascending. Zero comes first only when `allowZero` is on. */
export function estimateValues(scale: EstimateScale, allowZero: boolean): number[] {
  const values = SCALE_VALUES[scale]
  if (values.length === 0) return []
  return allowZero ? [0, ...values] : [...values]
}

export type EstimateSettings = { estimateScale: EstimateScale; estimateAllowZero: boolean }

/**
 * `null` (no estimate) is always valid. Anything else must be on the team's
 * scale, so a team with estimates off can only clear them.
 */
export function assertValidEstimate(team: EstimateSettings, value: number | null) {
  if (value === null) return
  if (team.estimateScale === 'off') {
    throw new DomainError('BAD_REQUEST', 'Estimates are turned off for this team')
  }
  if (!estimateValues(team.estimateScale, team.estimateAllowZero).includes(value)) {
    throw new DomainError('BAD_REQUEST', "Estimate isn't on the team's scale")
  }
}
