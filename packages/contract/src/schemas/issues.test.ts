import { describe, expect, it } from 'vitest'
import { issueIdentifierSchema } from './issues'

describe('issueIdentifierSchema', () => {
  it('normalizes case and leading zeros', () => {
    expect(issueIdentifierSchema.parse(' lin-012 ')).toEqual({ teamKey: 'LIN', number: 12 })
  })

  it.each(['LIN', 'LIN-', '1IN-2', 'L-2', 'LIN-2a', 'LIN 2'])('rejects %s', (value) => {
    expect(issueIdentifierSchema.safeParse(value).success).toBe(false)
  })
})
