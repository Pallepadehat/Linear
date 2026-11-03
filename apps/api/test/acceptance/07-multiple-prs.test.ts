import { describe, expect, it } from 'vitest'
import { pullRequestEvent, setupGithubAcceptance } from './github'

// PRD §12 Test 7 (rule B with several required PRs).
const { arrange, deliver, issueState, linksOf } = await setupGithubAcceptance()

const pr42 = { id: 2_100_000_042, number: 42, branch: 'tip-200-fix-login' }
const pr43 = { id: 2_100_000_043, number: 43, branch: 'tip-200-add-tests' }

describe('acceptance: 7 multiple prs', () => {
  it('stays In Progress until both required PRs #42 and #43 have merged', async () => {
    const { issue } = await arrange()
    await deliver(pullRequestEvent('opened', pr42))
    await deliver(pullRequestEvent('opened', pr43))
    expect((await linksOf(issue.id)).map((l) => l.number)).toEqual([42, 43])

    await deliver(pullRequestEvent('closed.merged', pr42))
    expect((await issueState(issue.id)).status).toBe('In Progress')

    await deliver(pullRequestEvent('closed.merged', pr43))
    expect((await issueState(issue.id)).status).toBe('Done')
  })
})
