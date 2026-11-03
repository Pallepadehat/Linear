import { describe, expect, it } from 'vitest'
import {
  BRANCH_SLUG_MAX,
  branchSlug,
  descriptionBranch,
  issueBranchName,
  userHandle,
} from './issue-branch'

const user = { name: 'Demo User', email: 'demo.user@tip.dev' }
const issue = (title: string, description: string | null = null) => ({
  identifier: 'TIP-200',
  title,
  description,
})

describe('issueBranchName', () => {
  it('builds <handle>/<identifier>-<slug>', () => {
    expect(issueBranchName(issue('Fix login validation'), user)).toBe(
      'demo-user/tip-200-fix-login-validation',
    )
  })

  it('uses the branch from the description when present', () => {
    const description = '**Branch:** `feat/m7-08-copy-actions`\n\nAdd copy buttons.'
    expect(issueBranchName(issue('Copy actions', description), user)).toBe(
      'feat/m7-08-copy-actions',
    )
  })

  it('reads the branch only from the first non-empty line', () => {
    const description = '\n\nIntro\n\n**Branch:** `feat/other`'
    expect(issueBranchName(issue('Copy', description), user)).toBe('demo-user/tip-200-copy')
  })

  it('leaves the handle out without a user', () => {
    expect(issueBranchName(issue('Fix it'), null)).toBe('tip-200-fix-it')
  })

  it('is just the identifier when the title has no ASCII words', () => {
    expect(issueBranchName(issue('!!!'), null)).toBe('tip-200')
  })
})

describe('branchSlug', () => {
  it('lowercases, strips accents and collapses non-alphanumerics', () => {
    expect(branchSlug('  Fix: Login -- (Café) API!! ')).toBe('fix-login-cafe-api')
  })

  it('caps at 60 chars without cutting a word', () => {
    const title =
      'Make the issue detail page copy buttons work with every keyboard layout we support'
    const slug = branchSlug(title)
    expect(slug.length).toBeLessThanOrEqual(BRANCH_SLUG_MAX)
    expect(slug).toBe('make-the-issue-detail-page-copy-buttons-work-with-every')
  })

  it('keeps a word that ends exactly at the cap', () => {
    expect(branchSlug(`${'a'.repeat(55)} bcde ghi`)).toBe(`${'a'.repeat(55)}-bcde`)
  })

  it('cuts a single long word at the cap', () => {
    expect(branchSlug('x'.repeat(80))).toBe('x'.repeat(60))
  })
})

describe('descriptionBranch', () => {
  it('is null without a branch line', () => {
    expect(descriptionBranch(null)).toBeNull()
    expect(descriptionBranch('Branch: feat/x')).toBeNull()
  })
})

describe('userHandle', () => {
  it('falls back to the name when the email local part has no ASCII', () => {
    expect(userHandle({ name: 'Ada Lovelace', email: '李@tip.dev' })).toBe('ada-lovelace')
  })
})
