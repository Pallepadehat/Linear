import { argon2Sync, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { accounts } from '@linear/db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from '../harness'

// How passwords are stored (Better Auth: scrypt N=16384, r=16, p=1, 64-byte key, 16-byte
// random salt, stored as `<salt hex>:<key hex>`), and why that beats a plain MD5 digest.
const { app, db } = await setupTestApp()

const PASSWORD = 'password123'
const md5 = (value: string) => createHash('md5').update(value).digest('hex')

async function storedHash(userId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.userId, userId))
  return account!.password!
}

describe('security: password storage', () => {
  it('stores a salted scrypt hash, never the password or its MD5', async () => {
    const { userId } = await signUp(app, 'Hash One')
    const hash = await storedHash(userId)

    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(hash).not.toContain(PASSWORD)
    expect(hash).not.toContain(md5(PASSWORD))
  })

  it('gives two users with the same password different hashes (random salt)', async () => {
    const a = await signUp(app, 'Same Password A')
    const b = await signUp(app, 'Same Password B')
    expect(await storedHash(a.userId)).not.toBe(await storedHash(b.userId))
  })

  it('can be re-derived from the salt, which is how sign-in verifies it', async () => {
    const { userId } = await signUp(app, 'Verify')
    const [salt, key] = (await storedHash(userId)).split(':') as [string, string]
    const derive = (password: string) =>
      scryptSync(password.normalize('NFKC'), salt, 64, {
        N: 16384,
        r: 16,
        p: 1,
        maxmem: 128 * 16384 * 16 * 2,
      })

    expect(timingSafeEqual(derive(PASSWORD), Buffer.from(key, 'hex'))).toBe(true)
    expect(timingSafeEqual(derive('password124'), Buffer.from(key, 'hex'))).toBe(false)
  })
})

describe('security: MD5 vs. password hashing functions', () => {
  it('MD5 is unsalted: the same password always gives the same digest (rainbow tables)', () => {
    expect(md5(PASSWORD)).toBe(md5(PASSWORD))
    expect(md5(PASSWORD)).toBe('482c811da5d5b4bc6d497ffa98491e38')
  })

  it('MD5 is fast enough to guess passwords by the hundred thousand', () => {
    const started = performance.now()
    for (let i = 0; i < 100_000; i++) md5(`guess-${i}`)
    const md5PerSecond = 100_000 / ((performance.now() - started) / 1000)

    const salt = randomBytes(16)
    const scryptStarted = performance.now()
    for (let i = 0; i < 5; i++) {
      scryptSync(`guess-${i}`, salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 })
    }
    const scryptPerSecond = 5 / ((performance.now() - scryptStarted) / 1000)

    // Orders of magnitude apart on any machine; the exact ratio is printed for the report.
    console.info(
      `[hashing] md5 ${Math.round(md5PerSecond)}/s, scrypt ${scryptPerSecond.toFixed(1)}/s`,
    )
    expect(md5PerSecond / scryptPerSecond).toBeGreaterThan(1000)
  })

  it('Argon2id: salted, memory-hard, and verifies only the right password', () => {
    const nonce = randomBytes(16)
    const hash = (message: string) =>
      argon2Sync('argon2id', {
        message,
        nonce,
        parallelism: 1,
        tagLength: 32,
        memory: 19456,
        passes: 2,
      })

    const stored = hash(PASSWORD)
    expect(timingSafeEqual(hash(PASSWORD), stored)).toBe(true)
    expect(timingSafeEqual(hash('Password123'), stored)).toBe(false)
    // Another salt, another hash: precomputed tables are useless.
    const other = argon2Sync('argon2id', {
      message: PASSWORD,
      nonce: randomBytes(16),
      parallelism: 1,
      tagLength: 32,
      memory: 19456,
      passes: 2,
    })
    expect(other.equals(stored)).toBe(false)
  })
})
