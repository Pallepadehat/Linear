import { describe, expect, it } from 'vitest'
import { linkTypeLabel, pullRequestRef, pullRequestStates } from './pull-requests'

describe('pull request display', () => {
  it('labels every state, and draft looks different from open', () => {
    expect(Object.values(pullRequestStates).map((s) => s.label)).toEqual([
      'Open',
      'Draft',
      'Merged',
      'Closed',
    ])
    expect(pullRequestStates.draft.iconClass).not.toBe(pullRequestStates.open.iconClass)
    expect(pullRequestStates.closed.iconClass).not.toBe(pullRequestStates.merged.iconClass)
  })

  it('names link types and references PRs as repo#number', () => {
    expect(linkTypeLabel).toEqual({ closing: 'Closes', reference: 'References' })
    expect(pullRequestRef({ repoFullName: 'tip/app', number: 42 })).toBe('tip/app#42')
  })
})
