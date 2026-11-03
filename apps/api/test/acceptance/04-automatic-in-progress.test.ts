import { describe, expect, it } from 'vitest'
import { pullRequestEvent, setupGithubAcceptance } from './github'

// PRD §12 Test 4 (rule A). Rule unit tests: packages/core/src/automation/evaluate.test.ts.
const { arrange, deliver, issueState, githubActivity } = await setupGithubAcceptance()

describe('acceptance: 4 automatic in progress', () => {
  it('moves a Todo issue to In Progress when an eligible linked PR opens', async () => {
    const { issue, statusId } = await arrange({ status: 'Todo' })
    expect((await issueState(issue.id)).status).toBe('Todo')

    await deliver(pullRequestEvent('opened'))

    expect((await issueState(issue.id)).status).toBe('In Progress')
    expect(await githubActivity(issue.id)).toEqual([
      expect.objectContaining({
        kind: 'status',
        actorId: null,
        from: await statusId('Todo'),
        to: await statusId('In Progress'),
      }),
    ])
  })
})
