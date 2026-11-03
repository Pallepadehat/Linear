import { describe, expect, it } from 'vitest'
import { issueBranchName, issueUrl } from './issue-links'

describe('issue links', () => {
  it('builds the issue URL', () => {
    expect(issueUrl('https://app.dev', 'tip', 'TIP-200')).toBe('https://app.dev/tip/issue/TIP-200')
  })

  it('starts the branch with the identifier and slugs the title', () => {
    expect(issueBranchName('TIP-200', 'Fix login: redirect loop!')).toBe(
      'tip-200-fix-login-redirect-loop',
    )
    expect(issueBranchName('TIP-1', 'Café ✨')).toBe('tip-1-cafe')
    expect(issueBranchName('TIP-1', '!!!')).toBe('tip-1')
    expect(issueBranchName('TIP-2', 'a'.repeat(60))).toBe(`tip-2-${'a'.repeat(40)}`)
  })
})
