import { describe, expect, it } from 'vitest'
import { pullRequestEvent, setupGithubAcceptance } from './github'

// PRD §12 Test 6 (rule C).
const { arrange, deliver, issueState, linksOf } = await setupGithubAcceptance()

describe('acceptance: 6 closed without merge', () => {
  it('does not complete the issue when its linked PR is closed without merging', async () => {
    const { issue } = await arrange()
    await deliver(pullRequestEvent('opened'))

    await deliver(pullRequestEvent('closed.unmerged'))

    expect(await issueState(issue.id)).toMatchObject({ status: 'In Progress', completedAt: null })
    expect(await linksOf(issue.id)).toEqual([{ type: 'closing', number: 42, state: 'closed' }])
  })
})
