import { describe, expect, it } from 'vitest'
import { assertReplyParent } from './threads'

const ISSUE = '01890a5d-ac96-774b-bcce-b302099a8057'
const OTHER_ISSUE = '01890a5d-ac96-774b-bcce-b302099a8058'
const ROOT = '01890a5d-ac96-774b-bcce-b302099a8059'

describe('assertReplyParent', () => {
  it('accepts a root comment on the same issue', () => {
    expect(() => assertReplyParent({ issueId: ISSUE, parentId: null }, ISSUE)).not.toThrow()
  })

  it('rejects a reply to a reply', () => {
    expect(() => assertReplyParent({ issueId: ISSUE, parentId: ROOT }, ISSUE)).toThrow(
      expect.objectContaining({ code: 'BAD_REQUEST' }),
    )
  })

  it('rejects a parent on another issue', () => {
    expect(() => assertReplyParent({ issueId: OTHER_ISSUE, parentId: null }, ISSUE)).toThrow(
      expect.objectContaining({ code: 'BAD_REQUEST' }),
    )
  })

  it('treats a missing parent as not found', () => {
    expect(() => assertReplyParent(undefined, ISSUE)).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })
})
