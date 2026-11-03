import { describe, expect, it } from 'vitest'
import { createStorage } from './storage'

const config = {
  endpoint: 'http://storage:9000',
  region: 'us-east-1',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'uploads',
}

describe('createStorage presigning', () => {
  it('signs for the internal endpoint by default', async () => {
    const url = new URL(await createStorage(config).presignGet('a/b.png'))
    expect(url.origin).toBe('http://storage:9000')
  })

  it('signs for the public endpoint when one is set', async () => {
    const storage = createStorage({ ...config, publicEndpoint: 'http://localhost:9000' })
    const get = new URL(await storage.presignGet('a/b.png'))
    const put = new URL(await storage.presignPut('a/b.png', 'image/png', 10))
    expect(get.origin).toBe('http://localhost:9000')
    expect(put.origin).toBe('http://localhost:9000')
    expect(get.pathname).toBe('/uploads/a/b.png')
  })
})
