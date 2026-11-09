import { describe, expect, it } from 'vitest'
import { INVITE_CODE_LENGTH, generateInviteCode, normalizeInviteCode } from './invites'

describe('invite codes', () => {
  it('generates fixed-length codes without look-alike characters', () => {
    const codes = Array.from({ length: 200 }, generateInviteCode)
    for (const code of codes) {
      expect(code).toHaveLength(INVITE_CODE_LENGTH)
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/)
    }
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('normalizes case, spaces and dashes', () => {
    expect(normalizeInviteCode(' abcde-fghjk ')).toBe('ABCDEFGHJK')
    expect(normalizeInviteCode('ABCDE FGHJK')).toBe('ABCDEFGHJK')
  })
})
