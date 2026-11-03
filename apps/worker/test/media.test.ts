import { createUpload } from '@linear/core'
import { createDb, uploads } from '@linear/db'
import { createUser, testDatabaseUrl, truncateAll } from '@linear/db/testing'
import { loadRootEnvFile } from '@linear/env'
import { createMemoryStorage } from '@linear/storage/testing'
import { eq } from 'drizzle-orm'
import { pino } from 'pino'
import sharp from 'sharp'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deleteObjects } from '../src/jobs/maintenance/delete-objects'
import { cleanupPending } from '../src/jobs/maintenance/cleanup-pending'
import { processImage } from '../src/jobs/media/process-image'

loadRootEnvFile()
const { db, close } = createDb(testDatabaseUrl(), { max: 2 })
const { storage, objects } = createMemoryStorage()
const deps = { db, storage, logger: pino({ level: 'silent' }), publish: async () => {} }

beforeEach(async () => {
  await truncateAll(db)
  objects.clear()
})
afterAll(close)

async function readyAvatar(status: 'pending' | 'ready' = 'ready') {
  const user = await createUser(db)
  const upload = await createUpload(db, {
    kind: 'avatar',
    uploadedById: user.id,
    workspaceId: null,
    contentType: 'image/jpeg',
    size: 1,
    objectKey: (id) => `users/${user.id}/avatar/${id}/original.jpg`,
  })
  await db.update(uploads).set({ status }).where(eq(uploads.id, upload.id))
  const jpeg = await sharp({
    create: { width: 600, height: 400, channels: 3, background: '#5e6ad2' },
  })
    .withExif({ IFD0: { Copyright: 'secret-location' } })
    .jpeg()
    .toBuffer()
  objects.set(upload.objectKey, { body: jpeg, contentType: 'image/jpeg' })
  return upload
}

describe('process-image', () => {
  it('writes square webp variants and strips metadata from the original', async () => {
    const upload = await readyAvatar()
    await processImage(deps, upload.id)

    const [row] = await db.select().from(uploads).where(eq(uploads.id, upload.id))
    expect(Object.keys(row!.variants).sort()).toEqual(['256', '64', 'original'])
    const small = await sharp(objects.get(row!.variants['64']!)!.body).metadata()
    expect(small).toMatchObject({ format: 'webp', width: 64, height: 64 })
    const original = await sharp(objects.get(upload.objectKey)!.body).metadata()
    expect(original.exif).toBeUndefined()
  })

  it('is idempotent', async () => {
    const upload = await readyAvatar()
    await processImage(deps, upload.id)
    const keys = [...objects.keys()].sort()
    await processImage(deps, upload.id)
    expect([...objects.keys()].sort()).toEqual(keys)
  })

  it('skips uploads that are not confirmed', async () => {
    const upload = await readyAvatar('pending')
    await processImage(deps, upload.id)
    const [row] = await db.select().from(uploads).where(eq(uploads.id, upload.id))
    expect(row!.variants).toEqual({})
  })
})

describe('maintenance', () => {
  it('deletes objects only for deleted uploads', async () => {
    const upload = await readyAvatar()
    await processImage(deps, upload.id)
    await deleteObjects(deps, upload.id)
    expect(objects.size).toBe(3)

    await db.update(uploads).set({ status: 'deleted' }).where(eq(uploads.id, upload.id))
    await deleteObjects(deps, upload.id)
    expect(objects.size).toBe(0)
  })

  it('removes pending uploads older than 24 hours', async () => {
    const stale = await readyAvatar('pending')
    const fresh = await readyAvatar('pending')
    await db
      .update(uploads)
      .set({ createdAt: new Date('2026-01-01T00:00:00Z') })
      .where(eq(uploads.id, stale.id))

    await cleanupPending(deps, new Date('2026-01-02T01:00:00Z'))

    const rows = await db.select().from(uploads)
    expect(rows.find((r) => r.id === stale.id)!.status).toBe('deleted')
    expect(rows.find((r) => r.id === fresh.id)!.status).toBe('pending')
    expect(objects.has(stale.objectKey)).toBe(false)
  })
})
