import { describe, expect, it } from 'vitest'
import { setupTestApp } from '../harness'

// Hardening headers (OWASP A05 Security Misconfiguration) and HTTPS behaviour behind the TLS
// proxy (OWASP A02 Cryptographic Failures). Found missing by the OWASP ZAP baseline scan;
// added in src/plugins/security-headers.ts and re-tested here.
const http = await setupTestApp()
const https = await setupTestApp({ appUrl: 'https://linear.example' })

describe('security: response headers', () => {
  it.each(['/health', '/rpc/me/get', '/api/auth/get-session'])(
    'sends hardening headers on %s',
    async (url) => {
      const res = await http.app.inject({ method: url === '/health' ? 'GET' : 'POST', url })
      expect(res.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'cross-origin-opener-policy': 'same-origin',
      })
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'")
      expect(res.headers['x-powered-by']).toBeUndefined()
    },
  )

  it('does not send HSTS over plain HTTP', async () => {
    const res = await http.app.inject({ method: 'GET', url: '/health' })
    expect(res.headers['strict-transport-security']).toBeUndefined()
  })

  it('sends HSTS when the request reached the TLS proxy over HTTPS', async () => {
    const res = await http.app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-proto': 'https' },
    })
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
  })
})

describe('security: cookies over HTTPS', () => {
  it('marks the session cookie Secure (and __Secure-) when the app runs on https', async () => {
    const res = await https.app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: 'https://linear.example', 'x-forwarded-proto': 'https' },
      payload: {
        email: `${crypto.randomUUID()}@example.test`,
        password: 'password123',
        name: 'Tls',
      },
    })
    expect(res.statusCode).toBe(200)
    const session = [res.headers['set-cookie']]
      .flat()
      .find((c) => typeof c === 'string' && c.includes('session_token'))
    expect(session).toMatch(/^__Secure-/)
    expect(session).toMatch(/; Secure/i)
    expect(session).toMatch(/HttpOnly/i)
  })
})
