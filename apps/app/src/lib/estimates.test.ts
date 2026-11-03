import { describe, expect, it } from 'vitest'
import {
  estimateLabel,
  estimateShortLabel,
  estimateValues,
  scalePreview,
  sumEstimates,
} from './estimates'

describe('estimates', () => {
  it('lists values per scale, with zero only when allowed', () => {
    expect(estimateValues({ scale: 'fibonacci', allowZero: false })).toEqual([1, 2, 3, 5, 8])
    expect(estimateValues({ scale: 'fibonacci', allowZero: true })).toEqual([0, 1, 2, 3, 5, 8])
    expect(estimateValues({ scale: 'off', allowZero: true })).toEqual([])
  })

  it('labels points, t-shirt sizes and values off the scale', () => {
    expect(estimateLabel(1, 'linear')).toBe('1 Point')
    expect(estimateLabel(3, 'fibonacci')).toBe('3 Points')
    expect(estimateLabel(0, 'fibonacci')).toBe('0 Points')
    expect(estimateLabel(3, 'tshirt')).toBe('M')
    expect(estimateLabel(4, 'fibonacci')).toBe('4')
    expect(estimateLabel(4, 'tshirt')).toBe('4')
    expect(estimateShortLabel(8, 'tshirt')).toBe('XL')
    expect(estimateShortLabel(8, 'exponential')).toBe('8')
  })

  it('previews a scale', () => {
    expect(scalePreview({ scale: 'tshirt', allowZero: false })).toBe('XS, S, M, L, XL')
    expect(scalePreview({ scale: 'exponential', allowZero: true })).toBe('0, 1, 2, 4, 8, 16')
  })

  it('sums estimates of teams that use them', () => {
    const scales: Record<string, 'fibonacci' | 'off'> = { a: 'fibonacci', b: 'off' }
    const issues = [
      { teamId: 'a', estimate: 3 },
      { teamId: 'a', estimate: null },
      { teamId: 'a', estimate: 5 },
      { teamId: 'b', estimate: 8 },
      { teamId: 'c', estimate: 2 },
    ]
    expect(sumEstimates(issues, (id) => scales[id])).toBe(8)
  })
})
