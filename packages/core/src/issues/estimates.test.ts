import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors'
import { assertValidEstimate, estimateValues } from './estimates'

describe('estimateValues', () => {
  it('lists each scale without zero by default', () => {
    expect(estimateValues('linear', false)).toEqual([1, 2, 3, 4, 5])
    expect(estimateValues('fibonacci', false)).toEqual([1, 2, 3, 5, 8])
    expect(estimateValues('exponential', false)).toEqual([1, 2, 4, 8, 16])
    expect(estimateValues('tshirt', false)).toEqual([1, 2, 3, 5, 8])
  })

  it('adds zero first when allowZero is on, fibonacci included', () => {
    expect(estimateValues('linear', true)).toEqual([0, 1, 2, 3, 4, 5])
    expect(estimateValues('fibonacci', true)).toEqual([0, 1, 2, 3, 5, 8])
    expect(estimateValues('tshirt', true)).toEqual([0, 1, 2, 3, 5, 8])
  })

  it('offers nothing when the scale is off', () => {
    expect(estimateValues('off', false)).toEqual([])
    expect(estimateValues('off', true)).toEqual([])
  })
})

describe('assertValidEstimate', () => {
  const fibonacci = { estimateScale: 'fibonacci' as const, estimateAllowZero: false }

  function codeOf(fn: () => void) {
    try {
      fn()
    } catch (error) {
      return error instanceof DomainError ? error.code : 'unexpected'
    }
    return null
  }

  it('accepts values on the scale and null', () => {
    expect(codeOf(() => assertValidEstimate(fibonacci, 5))).toBeNull()
    expect(codeOf(() => assertValidEstimate(fibonacci, null))).toBeNull()
  })

  it('rejects values not on the scale', () => {
    expect(codeOf(() => assertValidEstimate(fibonacci, 4))).toBe('BAD_REQUEST')
    expect(codeOf(() => assertValidEstimate({ ...fibonacci, estimateScale: 'tshirt' }, 4))).toBe(
      'BAD_REQUEST',
    )
  })

  it('accepts zero only when allowZero is on', () => {
    expect(codeOf(() => assertValidEstimate(fibonacci, 0))).toBe('BAD_REQUEST')
    expect(
      codeOf(() => assertValidEstimate({ ...fibonacci, estimateAllowZero: true }, 0)),
    ).toBeNull()
  })

  it('rejects every value when the scale is off, but still allows clearing', () => {
    const off = { estimateScale: 'off' as const, estimateAllowZero: true }
    expect(codeOf(() => assertValidEstimate(off, 0))).toBe('BAD_REQUEST')
    expect(codeOf(() => assertValidEstimate(off, 1))).toBe('BAD_REQUEST')
    expect(codeOf(() => assertValidEstimate(off, null))).toBeNull()
  })
})
