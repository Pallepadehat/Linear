import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from '../harness'

// Login and session handling (OWASP A07 Identification and Authentication Failures).
const { app } = await setupTestApp()

const ORIGIN = 'http://localhost:5173'

function signIn(email: string, password: string, origin = ORIGIN) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin },
    payload: { email, password },
  })
}

function signUpWith(password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: ORIGIN },
    payload: { email: `${crypto.randomUUID()}@example.test`, password, name: 'Boundary' },
  })
}

const cookiesOf = (res: { headers: Record<string, unknown> }) =>
  [res.headers['set-cookie']].flat().filter((c): c is string => typeof c === 'string')

describe('security: authentication', () => {
  it('answers a wrong password and an unknown email the same way (no user enumeration)', async () => {
    const { email } = await signUp(app, 'Enum')
    const wrongPassword = await signIn(email, 'not-the-password')
    const unknownEmail = await signIn('nobody@example.test', 'not-the-password')

    expect(wrongPassword.statusCode).toBe(401)
    expect(unknownEmail.statusCode).toBe(401)
    expect(unknownEmail.json()).toEqual(wrongPassword.json())
    expect(cookiesOf(wrongPassword)).toEqual([])
  })

  // Boundary values around the 8-character minimum.
  it.each([
    ['', 400],
    ['1234567', 400],
    ['12345678', 200],
  ])('sign-up with a %j password → %i', async (password, status) => {
    expect((await signUpWith(password)).statusCode).toBe(status)
  })

  it('rejects SQL injection in the login form', async () => {
    const { email } = await signUp(app, 'Injection')
    for (const [user, password] of [
      [email, "' OR '1'='1"],
      [`${email}' --`, 'anything'],
      ["' OR 1=1 --@example.test", "' OR '1'='1"],
    ] as const) {
      const res = await signIn(user, password)
      expect([400, 401]).toContain(res.statusCode)
      expect(cookiesOf(res)).toEqual([])
    }
  })

  it('issues an HttpOnly, SameSite session cookie that scripts cannot read', async () => {
    const { email } = await signUp(app, 'Cookie')
    const res = await signIn(email, 'password123')
    const session = cookiesOf(res).find((c) => c.includes('session_token'))

    expect(session).toBeDefined()
    expect(session).toMatch(/HttpOnly/i)
    expect(session).toMatch(/SameSite=Lax/i)
    // The token is signed: it is never the raw session id from the database.
    expect(session).toMatch(/session_token=[^.;]+\.[^;]+/)
  })

  it('rejects a forged or tampered session cookie', async () => {
    const { cookie } = await signUp(app, 'Tamper')
    const forged = cookie.replace(/session_token=([^;]+)/, (_, value: string) => {
      const [token] = value.split('.')
      return `session_token=${token}.forged-signature`
    })

    await expect(rpcClient(app, forged).me.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      rpcClient(app, 'better-auth.session_token=made-up').me.get(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('refuses sign-in from an untrusted origin (CSRF)', async () => {
    const { email } = await signUp(app, 'Csrf')
    const res = await signIn(email, 'password123', 'https://evil.example')
    expect(res.statusCode).toBe(403)
    expect(cookiesOf(res)).toEqual([])
  })

  it('ends the session server-side on sign-out', async () => {
    const { cookie, client } = await signUp(app, 'Logout')
    await client.me.get()
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { origin: ORIGIN, cookie },
    })
    // The old cookie is useless even if an attacker copied it before the logout.
    await expect(rpcClient(app, cookie).me.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
