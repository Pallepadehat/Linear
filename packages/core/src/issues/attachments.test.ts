import { describe, expect, it } from 'vitest'
import { parseAttachmentIds } from './attachments'

const A = '01890a5d-ac96-774b-bcce-b302099a8057'
const B = '01890a5d-ac96-774b-bcce-b302099a8058'

describe('parseAttachmentIds', () => {
  it('returns nothing for an empty description', () => {
    expect(parseAttachmentIds(null)).toEqual([])
    expect(parseAttachmentIds(undefined)).toEqual([])
    expect(parseAttachmentIds('')).toEqual([])
  })

  it('finds image and file references, with titles and angle brackets', () => {
    const markdown = [
      `![screenshot.png](attachment:${A})`,
      `See [spec.pdf](attachment:${B} "Spec") and [again](<attachment:${A}>).`,
    ].join('\n\n')
    expect(parseAttachmentIds(markdown)).toEqual([A, B])
  })

  it('normalizes case and removes duplicates', () => {
    expect(parseAttachmentIds(`[a](attachment:${A.toUpperCase()}) [b](attachment:${A})`)).toEqual([
      A,
    ])
  })

  it('ignores prose, other schemes, placeholders and malformed ids', () => {
    const markdown = [
      `attachment:${A} in plain text`,
      `[link](https://example.com/attachment:${B})`,
      '![uploading](attachment:pending-1)',
      '[bad](attachment:01890a5d-ac96-774b)',
    ].join('\n')
    expect(parseAttachmentIds(markdown)).toEqual([])
  })
})
