import { pullRequests } from '@linear/db'
import { describe, expect, it } from 'vitest'
import { pullRequestEvent, setupGithubAcceptance } from './github'

// PRD §12 Test 3: signed webhook → API → queue → worker → DB.
// Parser cases: packages/core/src/github/parse-identifiers.test.ts.
const { db, arrange, deliver, linksOf } = await setupGithubAcceptance()

describe('acceptance: 3 github linking', () => {
  it('links a PR opened from tip-200-fix-login to TIP-200', async () => {
    const { issue } = await arrange()

    const { status } = await deliver(
      pullRequestEvent('opened', { branch: 'tip-200-fix-login', title: 'Fix login validation' }),
    )

    expect(status).toBe('processed')
    expect(await db.select().from(pullRequests)).toMatchObject([
      { number: 42, branch: 'tip-200-fix-login', state: 'open' },
    ])
    expect(await linksOf(issue.id)).toEqual([{ type: 'closing', number: 42, state: 'open' }])
  })
})
