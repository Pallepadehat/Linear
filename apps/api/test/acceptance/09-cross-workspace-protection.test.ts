import { describe, expect, it } from 'vitest'
import { TIP_REPO_ID, pullRequestEvent, setupGithubAcceptance } from './github'

// PRD §12 Test 9.
const { arrange, deliver, issueState, linksOf, githubActivity } = await setupGithubAcceptance()

describe('acceptance: 9 cross-workspace protection', () => {
  it('does not modify an issue in another workspace when an unrelated repo references it', async () => {
    const { issue: theirs } = await arrange({ key: 'TIP', repoId: TIP_REPO_ID })
    // An unrelated workspace with its own connected repository.
    const otherRepoId = TIP_REPO_ID + 1
    await arrange({ key: 'OPS', repoId: otherRepoId })
    const before = await issueState(theirs.id)

    const { status } = await deliver(
      pullRequestEvent('opened', {
        repoId: otherRepoId,
        branch: 'tip-200-fix-login',
        body: 'Fixes TIP-200',
      }),
    )

    expect(status).toBe('processed')
    expect(await linksOf(theirs.id)).toEqual([])
    expect(await githubActivity(theirs.id)).toEqual([])
    expect(await issueState(theirs.id)).toEqual(before)
  })
})
