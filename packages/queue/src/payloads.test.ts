import { describe, expect, it } from 'vitest'
import { parseJobPayload } from './payloads'

describe('parseJobPayload', () => {
  it('accepts a valid payload', () => {
    const uploadId = '01890a5d-ac96-774b-bcce-b302099a8057'
    expect(parseJobPayload('media', 'process-image', { uploadId })).toEqual({ uploadId })
  })

  it('rejects payloads that are not IDs', () => {
    expect(() => parseJobPayload('media', 'process-image', { uploadId: 'nope' })).toThrow()
  })
})
