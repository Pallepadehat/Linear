import { createUpload } from '@linear/core'
import { createDb, issueAttachments, uploads } from '@linear/db'
import {
  createIssue,
  createTeam,
  createUser,
  createWorkspace,
  testDatabaseUrl,
  truncateAll,
} from '@linear/db/testing'
import { loadRootEnvFile } from '@linear/env'
import { createMemoryStorage } from '@linear/storage/testing'
import { eq } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ORPHANED_ATTACHMENT_TTL_MS,
  cleanupAttachments,
} from '../src/jobs/maintenance/cleanup-attachments'

loadRootEnvFile()
const { db, close } = createDb(testDatabaseUrl(), { max: 2 })
const { storage, objects } = createMemoryStorage()
const deps = { db, storage, logger: pino({ level: 'silent' }), publish: async () => {} }

beforeEach(async () => {
  await truncateAll(db)
  objects.clear()
})
afterAll(close)

async function arrange() {
  const user = await createUser(db)
  const workspace = await createWorkspace(db, { ownerId: user.id })
  const team = await createTeam(db, { workspaceId: workspace.id, key: 'TIP' })
  const issue = await createIssue(db, { teamId: team.id, creatorId: user.id })

  async function attachment(touchedAgoMs: number) {
    const upload = await createUpload(db, {
      kind: 'attachment',
      uploadedById: user.id,
      workspaceId: workspace.id,
      contentType: 'application/pdf',
      size: 1,
      objectKey: (id) => `workspaces/${workspace.id}/attachment/${id}/original.pdf`,
    })
    await db
      .update(uploads)
      .set({ status: 'ready', updatedAt: new Date(Date.now() - touchedAgoMs) })
      .where(eq(uploads.id, upload.id))
    objects.set(upload.objectKey, { body: new Uint8Array(1), contentType: upload.contentType })
    return upload
  }

  return { workspace, issue, attachment }
}

async function statusOf(uploadId: string) {
  const [upload] = await db.select().from(uploads).where(eq(uploads.id, uploadId))
  return upload!.status
}

describe('cleanup-attachments', () => {
  it('deletes attachments unreferenced for more than 24 h, and only those', async () => {
    const { workspace, issue, attachment } = await arrange()
    const day = ORPHANED_ATTACHMENT_TTL_MS
    const abandoned = await attachment(day + 60_000)
    const recent = await attachment(day - 60_000)
    const linked = await attachment(day + 60_000)
    await db
      .insert(issueAttachments)
      .values({ workspaceId: workspace.id, issueId: issue.id, uploadId: linked.id })

    await cleanupAttachments(deps)

    expect(await statusOf(abandoned.id)).toBe('deleted')
    expect(objects.has(abandoned.objectKey)).toBe(false)
    expect(await statusOf(recent.id)).toBe('ready')
    expect(objects.has(recent.objectKey)).toBe(true)
    expect(await statusOf(linked.id)).toBe('ready')
    expect(objects.has(linked.objectKey)).toBe(true)

    // Idempotent: a second run finds nothing new.
    await cleanupAttachments(deps)
    expect(await statusOf(recent.id)).toBe('ready')
  })
})
