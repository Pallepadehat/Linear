import { describe, expect, it } from 'vitest'
import { signInstallState, verifyInstallState } from './install-state'

const secret = 'test-secret-test-secret-test-secret'
const state = { workspaceId: 'w-1', userId: 'u-1' }
const now = 1_000_000

describe('install state', () => {
  it('round-trips', () => {
    expect(verifyInstallState(signInstallState(state, secret, now), secret, now)).toEqual(state)
  })

  it('expires after ten minutes', () => {
    const token = signInstallState(state, secret, now)
    expect(verifyInstallState(token, secret, now + 10 * 60 * 1000)).toEqual(state)
    expect(verifyInstallState(token, secret, now + 10 * 60 * 1000 + 1)).toBeNull()
  })

  it('rejects another secret', () => {
    expect(verifyInstallState(signInstallState(state, secret, now), 'other', now)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const [, signature] = signInstallState(state, secret, now).split('.')
    const forged = Buffer.from(JSON.stringify({ w: 'w-2', u: 'u-1', e: now + 1 })).toString(
      'base64url',
    )
    expect(verifyInstallState(`${forged}.${signature}`, secret, now)).toBeNull()
  })

  it.each(['', 'abc', 'a.b.c', '.sig', 'payload.'])('rejects malformed token %j', (token) => {
    expect(verifyInstallState(token, secret, now)).toBeNull()
  })
})
