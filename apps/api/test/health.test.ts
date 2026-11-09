import { describe, expect, it } from 'vitest'
import { setupTestApp } from './harness'

const { app } = await setupTestApp()

describe('GET /health', () => {
  it('reports database and redis up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', database: 'up', redis: 'up' })
  })
})
