import { describe, expect, it } from 'vitest'
import { relationFor } from './relation-kinds'

describe('relationFor', () => {
  it('stores each choice in its fixed direction', () => {
    expect(relationFor('blockedBy', 'a', 'b')).toEqual({
      issueId: 'b',
      relatedIssueId: 'a',
      type: 'blocks',
    })
    expect(relationFor('blocking', 'a', 'b')).toEqual({
      issueId: 'a',
      relatedIssueId: 'b',
      type: 'blocks',
    })
    expect(relationFor('related', 'a', 'b')).toEqual({
      issueId: 'a',
      relatedIssueId: 'b',
      type: 'related',
    })
    expect(relationFor('duplicateOf', 'a', 'b')).toEqual({
      issueId: 'a',
      relatedIssueId: 'b',
      type: 'duplicate',
    })
  })
})
