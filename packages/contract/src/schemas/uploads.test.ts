import { describe, expect, it } from 'vitest'
import { createPresignedUploadInputSchema } from './uploads'

describe('createPresignedUploadInputSchema', () => {
  it('accepts a small png avatar', () => {
    const result = createPresignedUploadInputSchema.safeParse({
      kind: 'avatar',
      contentType: 'image/png',
      size: 1000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an avatar over 2 MB before anything is presigned', () => {
    const result = createPresignedUploadInputSchema.safeParse({
      kind: 'avatar',
      contentType: 'image/png',
      size: 2 * 1024 * 1024 + 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unsupported types', () => {
    const result = createPresignedUploadInputSchema.safeParse({
      kind: 'avatar',
      contentType: 'image/gif',
      size: 10,
    })
    expect(result.success).toBe(false)
  })

  it('accepts attachments up to 25 MB in a workspace', () => {
    const pdf = { kind: 'attachment', contentType: 'application/pdf', workspaceSlug: 'tip' }
    expect(
      createPresignedUploadInputSchema.safeParse({ ...pdf, size: 25 * 1024 * 1024 }).success,
    ).toBe(true)
    expect(
      createPresignedUploadInputSchema.safeParse({ ...pdf, size: 25 * 1024 * 1024 + 1 }).success,
    ).toBe(false)
    expect(
      createPresignedUploadInputSchema.safeParse({ ...pdf, workspaceSlug: undefined, size: 10 })
        .success,
    ).toBe(false)
  })

  it('rejects html and svg attachments', () => {
    for (const contentType of ['text/html', 'image/svg+xml']) {
      const result = createPresignedUploadInputSchema.safeParse({
        kind: 'attachment',
        contentType,
        size: 10,
        workspaceSlug: 'tip',
      })
      expect(result.success).toBe(false)
    }
  })

  it('requires a workspace for workspace icons', () => {
    const result = createPresignedUploadInputSchema.safeParse({
      kind: 'workspace_icon',
      contentType: 'image/png',
      size: 10,
    })
    expect(result.success).toBe(false)
  })
})
