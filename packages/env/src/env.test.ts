import { describe, expect, it } from 'vitest'
import { loadApiEnv } from './index'
import { loadAppEnv } from './app'

const validApi = {
  DATABASE_URL: 'postgres://linear:linear@localhost:5432/linear',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
}

describe('loadApiEnv', () => {
  it('applies defaults', () => {
    const env = loadApiEnv(validApi)
    expect(env.PORT).toBe(3000)
    expect(env.S3_BUCKET).toBe('linear-uploads')
    expect(env.NODE_ENV).toBe('development')
  })

  it('rejects a short auth secret without echoing its value', () => {
    const secret = 'too-short-secret'
    expect(() => loadApiEnv({ ...validApi, BETTER_AUTH_SECRET: secret })).toThrow(
      /BETTER_AUTH_SECRET/,
    )
    try {
      loadApiEnv({ ...validApi, BETTER_AUTH_SECRET: secret })
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })
})

describe('loadAppEnv', () => {
  it('allows an empty API URL for the dev proxy', () => {
    expect(loadAppEnv({}).VITE_API_URL).toBe('')
  })
})
