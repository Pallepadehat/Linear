import { createComment, createIssue, subscribe, updateIssue } from '@linear/core'
import { createDb, notifications } from '@linear/db'
import {
  addMember,
  createTeam,
  createUser,
  createWorkspace,
  testDatabaseUrl,
  truncateAll,
} from '@linear/db/testing'
import { loadRootEnvFile } from '@linear/env'
import type { UserEvent } from '@linear/queue'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { processNotify } from '../src/jobs/notifications/notify'
import { createTestJobDeps } from '../src/testing'

loadRootEnvFile()
const { db, close } = createDb(testDatabaseUrl(), { max: 2 })
const sent: { userId: string; event: UserEvent }[] = []
const deps = createTestJobDeps(db, undefined, {
  publishToUser: async (userId, event) => void sent.push({ userId, event }),
})

beforeEach(async () => {
  sent.length = 0
  await truncateAll(db)
})
afterAll(close)

async function arrange() {
  const ada = await createUser(db, { name: 'Ada' })
  const bob = await createUser(db, { name: 'Bob' })
  const workspace = await createWorkspace(db, { ownerId: ada.id })
  await addMember(db, workspace.id, bob.id)
  const team = await createTeam(db, { workspaceId: workspace.id, memberIds: [ada.id, bob.id] })
  const issue = await createIssue(db, {
    workspaceId: workspace.id,
    teamId: team.id,
    creatorId: ada.id,
    title: 'Fix login',
  })
  return { ada, bob, workspace, team, issue }
}

describe('notify job', () => {
  it('creates one row per recipient when the same job runs twice', async () => {
    const { ada, bob, workspace, issue } = await arrange()
    await subscribe(db, { workspaceId: workspace.id, issueId: issue.id, userId: bob.id })
    const comment = await createComment(db, {
      workspaceId: workspace.id,
      issueId: issue.id,
      authorId: ada.id,
      body: 'Looks good',
    })
    const job = {
      workspaceId: workspace.id,
      issueId: issue.id,
      event: 'commented' as const,
      actorId: ada.id,
      commentId: comment.id,
    }

    await processNotify(deps, job)
    await processNotify(deps, job)

    const rows = await db.select().from(notifications)
    // Ada wrote the comment, so only Bob is notified, once.
    expect(rows).toEqual([
      expect.objectContaining({
        userId: bob.id,
        type: 'commented',
        payload: { commentId: comment.id },
      }),
    ])
    expect(sent).toEqual([
      {
        userId: bob.id,
        event: {
          type: 'notification.created',
          workspaceId: workspace.id,
          notificationId: rows[0]!.id,
        },
      },
    ])
  })

  it('notifies the new assignee from the assignee activity entry', async () => {
    const { ada, bob, workspace, issue } = await arrange()
    const updated = await updateIssue(db, {
      workspaceId: workspace.id,
      id: issue.id,
      assigneeId: bob.id,
      actor: { type: 'user', id: ada.id },
    })
    const activityId = updated.activity.find((a) => a.kind === 'assignee')!.id
    await processNotify(deps, {
      workspaceId: workspace.id,
      issueId: issue.id,
      event: 'assigned',
      actorId: ada.id,
      activityId,
    })
    expect(await db.select().from(notifications)).toEqual([
      expect.objectContaining({
        userId: bob.id,
        type: 'assigned',
        actorId: ada.id,
        actorType: 'user',
      }),
    ])
  })

  it('tells team members about a new issue, skipping the creator and non-members', async () => {
    const { ada, bob, workspace } = await arrange()
    // Still on the team, but no longer a workspace member.
    const leaver = await createUser(db)
    const team = await createTeam(db, {
      workspaceId: workspace.id,
      memberIds: [ada.id, bob.id, leaver.id],
    })
    const created = await createIssue(db, {
      workspaceId: workspace.id,
      teamId: team.id,
      creatorId: ada.id,
      title: 'New one',
    })
    const result = await processNotify(deps, {
      workspaceId: workspace.id,
      issueId: created.id,
      event: 'issue_created_in_team',
      actorId: ada.id,
      activityId: created.createdActivityId,
    })
    expect(result.map((n) => n.userId)).toEqual([bob.id])
  })
})
