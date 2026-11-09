import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app } = await setupTestApp()

describe('auth', () => {
  it('rejects unauthenticated procedure calls', async () => {
    await expect(rpcClient(app).me.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('signs up and keeps the session across requests', async () => {
    const { client, email } = await signUp(app, 'Ada')
    const me = await client.me.get()
    expect(me).toMatchObject({ name: 'Ada', email, avatarUrl: null })
  })

  it('signs in with the password and signs out', async () => {
    const { email } = await signUp(app, 'Grace')
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'http://localhost:5173' },
      payload: { email, password: 'password123' },
    })
    expect(signIn.statusCode).toBe(200)
    const cookie = [signIn.headers['set-cookie']]
      .flat()
      .map((c) => String(c).split(';')[0])
      .join('; ')
    expect(await rpcClient(app, cookie).me.get()).toMatchObject({ email })

    const signOut = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { origin: 'http://localhost:5173', cookie },
    })
    expect(signOut.statusCode).toBe(200)
    await expect(rpcClient(app, cookie).me.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects a wrong password', async () => {
    const { email } = await signUp(app, 'Linus')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'http://localhost:5173' },
      payload: { email, password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('never exposes password hashes', async () => {
    const { client } = await signUp(app, 'Hash')
    expect(JSON.stringify(await client.me.get())).not.toMatch(/password|scrypt/i)
  })
})
