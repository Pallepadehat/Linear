import { pullRequests, webhookDeliveries } from '@linear/db'
import { describe, expect, it } from 'vitest'
import { pullRequestEvent, setupGithubAcceptance } from './github'

// PRD §12 Test 8. Concurrent duplicates at the route: ../github-webhook.test.ts.
const { db, arrange, post, deliver, issueState, linksOf, githubActivity } =
  await setupGithubAcceptance()

describe('acceptance: 8 duplicate webhooks', () => {
  it('creates no duplicate PR links or activity when a processed delivery arrives again', async () => {
    const { issue } = await arrange()
    const payload = pullRequestEvent('opened')
    const { deliveryId } = await deliver(payload)
    const before = await issueState(issue.id)

    // The identical delivery (same GUID) is acknowledged without being queued again.
    expect((await post(payload, deliveryId)).statusCode).toBe(200)
    // The same content under a new delivery id is processed, with no new effects.
    expect((await deliver(payload)).status).toBe('processed')

    expect(await db.select().from(webhookDeliveries)).toHaveLength(2)
    expect(await db.select().from(pullRequests)).toHaveLength(1)
    expect(await linksOf(issue.id)).toHaveLength(1)
    expect(await githubActivity(issue.id)).toHaveLength(1)
    expect(await issueState(issue.id)).toEqual(before)
  })
})
