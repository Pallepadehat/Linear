import { describe, expect, it } from 'vitest'
import { pullRequestEvent, setupGithubAcceptance } from './github'

// PRD §12 Test 5 (rule B).
const { arrange, deliver, issueState, linksOf } = await setupGithubAcceptance()

describe('acceptance: 5 automatic completion', () => {
  it('completes the issue when its one required linked PR merges', async () => {
    const { issue } = await arrange()
    await deliver(pullRequestEvent('opened'))
    expect((await issueState(issue.id)).status).toBe('In Progress')

    await deliver(pullRequestEvent('closed.merged'))

    expect(await issueState(issue.id)).toMatchObject({
      status: 'Done',
      completedAt: expect.any(Date),
    })
    expect(await linksOf(issue.id)).toEqual([{ type: 'closing', number: 42, state: 'merged' }])
  })
})
