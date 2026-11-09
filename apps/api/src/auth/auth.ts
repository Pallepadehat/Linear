import { accounts, sessions, users, verifications, type Db } from '@linear/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { uuidv7 } from 'uuidv7'

export type AuthConfig = {
  db: Db
  secret: string
  baseURL: string
  trustedOrigins: string[]
}

export function createAuth(config: AuthConfig) {
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: '/api/auth',
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(config.db, {
      provider: 'pg',
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      // Refreshed on use, so active users stay signed in across refreshes and restarts.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      database: { generateId: () => uuidv7() },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
