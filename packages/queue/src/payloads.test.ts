import { describe, expect, it } from 'vitest'
import { notificationSourceKey, parseJobPayload } from './payloads'

describe('parseJobPayload', () => {
  it('accepts a valid payload', () => {
    const uploadId = '01890a5d-ac96-774b-bcce-b302099a8057'
    expect(parseJobPayload('media', 'process-image', { uploadId })).toEqual({ uploadId })
  })

  it('rejects payloads that are not IDs', () => {
    expect(() => parseJobPayload('media', 'process-image', { uploadId: 'nope' })).toThrow()
  })
})

describe('notify payload', () => {
  const base = {
    workspaceId: '01890a5d-ac96-774b-bcce-b302099a8057',
    issueId: '01890a5d-ac96-774b-bcce-b302099a8058',
    event: 'commented' as const,
    actorId: null,
  }
  const commentId = '01890a5d-ac96-774b-bcce-b302099a8059'

  it('needs exactly one source id', () => {
    expect(() => parseJobPayload('notifications', 'notify', base)).toThrow()
    expect(() =>
      parseJobPayload('notifications', 'notify', { ...base, commentId, activityId: commentId }),
    ).toThrow()
    expect(parseJobPayload('notifications', 'notify', { ...base, commentId })).toEqual({
      ...base,
      commentId,
    })
  })

  it('derives a colon-free source key from the event, issue and source', () => {
    const key = notificationSourceKey({ ...base, commentId })
    expect(key).toBe(`notify-commented-${base.issueId}-${commentId}`)
    expect(key).not.toContain(':')
  })
})
