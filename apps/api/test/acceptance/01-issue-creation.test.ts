import { teams } from '@linear/db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from '../harness'

// PRD §12 Test 1. Concurrency and numbering edge cases: ../issues.test.ts → createIssue.
const { app, db } = await setupTestApp()

describe('acceptance: 1 issue creation', () => {
  it('generates a unique identifier such as TIP-200 for a new issue in team TIP', async () => {
    const owner = await signUp(app, 'Owner')
    await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
    // Pretend 199 issues already exist.
    await db.update(teams).set({ issueCounter: 199 }).where(eq(teams.id, team.id))

    const issue = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Fix login',
    })
    const next = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Fix logout',
    })

    expect(issue).toMatchObject({ identifier: 'TIP-200', number: 200, title: 'Fix login' })
    expect(next.identifier).toBe('TIP-201')
    expect(
      await owner.client.issues.getByIdentifier({ workspaceSlug: 'tip', identifier: 'TIP-200' }),
    ).toEqual({ ...issue, parent: null, children: [] })
  })
})
