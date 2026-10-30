import {
  githubInstallations,
  githubRepositories,
  issuePullRequestLinks,
  pullRequests,
  webhookDeliveries,
} from '@linear/db'
import { createIssue, createTeam, createUser, createWorkspace } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { setupTestApp } from './harness'

const { db } = await setupTestApp()

describe('GitHub schema constraints', () => {
  it('deduplicates webhook deliveries before processing', async () => {
    const input = { deliveryId: 'delivery-1', event: 'pull_request', payload: { action: 'opened' } }
    const [delivery] = await db.insert(webhookDeliveries).values(input).returning()
    expect(delivery!.status).toBe('received')
    await expect(db.insert(webhookDeliveries).values(input)).rejects.toThrow()
  })

  it('prevents connecting the same GitHub repository to two workspaces', async () => {
    const user = await createUser(db)
    const first = await createWorkspace(db, { ownerId: user.id })
    const second = await createWorkspace(db, { ownerId: user.id })
    const [installation] = await db
      .insert(githubInstallations)
      .values({
        installationId: 100,
        workspaceId: first.id,
        accountLogin: 'first',
      })
      .returning()
    const [otherInstallation] = await db
      .insert(githubInstallations)
      .values({
        installationId: 101,
        workspaceId: second.id,
        accountLogin: 'second',
      })
      .returning()
    await db.insert(githubRepositories).values({
      githubRepoId: 200,
      workspaceId: first.id,
      installationId: installation!.id,
      fullName: 'first/repo',
    })
    await expect(
      db.insert(githubRepositories).values({
        githubRepoId: 200,
        workspaceId: second.id,
        installationId: otherInstallation!.id,
        fullName: 'first/repo',
      }),
    ).rejects.toThrow()
  })

  it('allows only one link per issue and PR regardless of link type', async () => {
    const user = await createUser(db)
    const workspace = await createWorkspace(db, { ownerId: user.id })
    const team = await createTeam(db, { workspaceId: workspace.id })
    const issue = await createIssue(db, { teamId: team.id, creatorId: user.id })
    const [installation] = await db
      .insert(githubInstallations)
      .values({
        installationId: 100,
        workspaceId: workspace.id,
        accountLogin: 'tip',
      })
      .returning()
    const [repository] = await db
      .insert(githubRepositories)
      .values({
        githubRepoId: 200,
        workspaceId: workspace.id,
        installationId: installation!.id,
        fullName: 'tip/repo',
      })
      .returning()
    const [pr] = await db
      .insert(pullRequests)
      .values({
        githubPrId: 300,
        repositoryId: repository!.id,
        workspaceId: workspace.id,
        number: 1,
        title: 'Fix issue',
        url: 'https://github.com/tip/repo/pull/1',
        branch: 'tip-1-fix',
        state: 'open',
      })
      .returning()
    const link = { workspaceId: workspace.id, issueId: issue.id, pullRequestId: pr!.id }
    await db.insert(issuePullRequestLinks).values({ ...link, type: 'closing' })
    await expect(
      db.insert(issuePullRequestLinks).values({ ...link, type: 'reference' }),
    ).rejects.toThrow()
  })
})
