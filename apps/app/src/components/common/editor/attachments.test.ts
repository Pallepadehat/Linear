import { describe, expect, it } from 'vitest'
import { attachmentError, attachmentHref, parseAttachmentId } from './attachments'

const id = '0190a6f2-1c2b-7d3e-8f40-123456789abc'

describe('attachment references', () => {
  it('round-trips an upload id', () => {
    expect(parseAttachmentId(attachmentHref(id))).toBe(id)
  })

  it('ignores other links and malformed ids', () => {
    expect(parseAttachmentId('https://example.com')).toBeNull()
    expect(parseAttachmentId('attachment:../../etc')).toBeNull()
    expect(parseAttachmentId(null)).toBeNull()
  })
})

describe('attachmentError', () => {
  it('accepts allowed types within the size limit', () => {
    expect(attachmentError({ type: 'application/pdf', size: 1000 })).toBeNull()
  })

  it('rejects other types and oversized files', () => {
    expect(attachmentError({ type: 'text/html', size: 10 })).toMatch(/image, PDF/)
    expect(attachmentError({ type: 'image/png', size: 25 * 1024 * 1024 + 1 })).toMatch(/25 MB/)
  })
})
