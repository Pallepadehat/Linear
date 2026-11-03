import { activityLog, issueSubscriptions, notifications } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { parseJobPayload } from '@linear/queue'
import { createTestJobDeps, processNotify } from '@linear/worker/testing'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db, queues } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }
const deps = createTestJobDeps(db)

/** Runs the `notify` jobs the API enqueued, like the worker would. */
async function runNotifyJobs() {
  const jobs = await queues.notifications.getJobs(['waiting', 'delayed', 'prioritized'])
  for (const job of jobs.reverse()) {
    await processNotify(deps, parseJobPayload('notifications', 'notify', job.data))
    await job.remove()
  }
}

const mention = (name: string, id: string) => `@[${name}](user:${id})`

/** Owner and Member in workspace `tip` (team TIP, issue TIP-1); Outsider in workspace `other`. */
async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ ...scope, name: 'Tip', key: 'TIP' })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  const outsider = await signUp(app, 'Outsider')
  await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
  const otherTeam = await outsider.client.teams.create({
    workspaceSlug: 'other',
    name: 'Other',
    key: 'OTH',
  })
  const otherIssue = await outsider.client.issues.create({
    workspaceSlug: 'other',
    teamId: otherTeam.id,
    title: 'Secret',
  })
  const issue = await owner.client.issues.create({ ...scope, teamId: team.id, title: 'Fix login' })
  await runNotifyJobs()
  return { owner, member, outsider, workspace, team, issue, otherIssue }
}

async function mentionNotifications(userId: string) {
  return db
    .select({ issueId: notifications.issueId, payload: notifications.payload })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, 'mentioned')))
}

async function isSubscribed(issueId: string, userId: string) {
  const rows = await db
    .select({ id: issueSubscriptions.id })
    .from(issueSubscriptions)
    .where(and(eq(issueSubscriptions.issueId, issueId), eq(issueSubscriptions.userId, userId)))
  return rows.length > 0
}

describe('mentions', () => {
  it('subscribes and notifies a user mentioned in a description, never the author', async () => {
    const { owner, member, team } = await arrange()
    const issue = await owner.client.issues.create({
      ...scope,
      teamId: team.id,
      title: 'With a mention',
      description: `Ping ${mention('Member', member.userId)} and ${mention('Owner', owner.userId)}`,
    })
    await runNotifyJobs()

    expect(await isSubscribed(issue.id, member.userId)).toBe(true)
    expect(await mentionNotifications(member.userId)).toEqual([{ issueId: issue.id, payload: {} }])
    expect(await mentionNotifications(owner.userId)).toEqual([])
    const { items } = await member.client.notifications.list(scope)
    expect(items.map((n) => n.summary)).toContain('Owner mentioned you')
  })

  it('notifies a mention in a comment once, instead of a comment notification', async () => {
    const { owner, member, issue } = await arrange()
    await owner.client.issues.subscribe({ ...scope, issueId: issue.id, userId: member.userId })
    const comment = await owner.client.comments.create({
      ...scope,
      issueId: issue.id,
      body: `${mention('Member', member.userId)} can you look?`,
    })
    await runNotifyJobs()

    const { items } = await member.client.notifications.list(scope)
    expect(items.map((n) => n.type)).toEqual(['mentioned'])
    expect(await mentionNotifications(member.userId)).toEqual([
      { issueId: issue.id, payload: { commentId: comment.id } },
    ])
  })

  it('does not re-notify existing mentions on edit, but notifies new ones', async () => {
    const { owner, member, workspace, issue } = await arrange()
    const third = await signUp(app, 'Third')
    await addMember(db, workspace.id, third.userId)
    const comment = await owner.client.comments.create({
      ...scope,
      issueId: issue.id,
      body: `Hi ${mention('Member', member.userId)}`,
    })
    await owner.client.issues.update({
      ...scope,
      id: issue.id,
      description: `Owner: ${mention('Member', member.userId)}`,
    })
    await runNotifyJobs()
    expect(await mentionNotifications(member.userId)).toHaveLength(2)

    // Edits that keep Member and add Third.
    await owner.client.comments.update({
      ...scope,
      id: comment.id,
      body: `Hi ${mention('Member', member.userId)} and ${mention('Third', third.userId)}`,
    })
    await owner.client.issues.update({
      ...scope,
      id: issue.id,
      description: `Owner: ${mention('Member', member.userId)}, ${mention('Third', third.userId)}`,
    })
    await runNotifyJobs()
    expect(await mentionNotifications(member.userId)).toHaveLength(2)
    expect(await mentionNotifications(third.userId)).toHaveLength(2)
    expect(await isSubscribed(issue.id, third.userId)).toBe(true)
  })

  it('ignores users and issues from another workspace, and unknown ones', async () => {
    const { owner, outsider, issue, otherIssue } = await arrange()
    const unknown = '0190a6f2-1c2b-7d3e-8f40-123456789abc'
    await owner.client.comments.create({
      ...scope,
      issueId: issue.id,
      body: `${mention('Outsider', outsider.userId)} ${mention('Ghost', unknown)} see OTH-1 and TIP-99`,
    })
    await runNotifyJobs()

    expect(await isSubscribed(issue.id, outsider.userId)).toBe(false)
    expect(await mentionNotifications(outsider.userId)).toEqual([])
    const backlinks = await db
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.issueId, otherIssue.id), eq(activityLog.kind, 'mentioned_in')))
    expect(backlinks).toEqual([])
  })

  it('backlinks a mentioned issue once, with the source title', async () => {
    const { owner, team, issue } = await arrange()
    const source = await owner.client.issues.create({
      ...scope,
      teamId: team.id,
      title: 'Source issue',
      description: 'Relates to TIP-1 (and itself, TIP-2)',
    })
    const comment = await owner.client.comments.create({
      ...scope,
      issueId: source.id,
      body: 'Also see TIP-1',
    })
    // Re-saving a description that still mentions TIP-1 adds nothing.
    await owner.client.issues.update({
      ...scope,
      id: source.id,
      description: 'Still relates to TIP-1',
    })

    const target = await owner.client.activity.list({ ...scope, issueId: issue.id })
    const mentions = target.items.filter((e) => e.kind === 'mentioned_in')
    expect(mentions).toEqual([
      expect.objectContaining({
        actorId: owner.userId,
        to: [source.id, 'TIP-2'],
        mentionedIn: {
          issueId: source.id,
          identifier: 'TIP-2',
          title: 'Source issue',
          commentId: null,
        },
      }),
      expect.objectContaining({
        to: [source.id, 'TIP-2', comment.id],
        mentionedIn: {
          issueId: source.id,
          identifier: 'TIP-2',
          title: 'Source issue',
          commentId: comment.id,
        },
      }),
    ])
    const self = await owner.client.activity.list({ ...scope, issueId: source.id })
    expect(self.items.some((e) => e.kind === 'mentioned_in')).toBe(false)
  })

  it('ignores mentions inside code', async () => {
    const { owner, member, issue } = await arrange()
    await owner.client.comments.create({
      ...scope,
      issueId: issue.id,
      body: `\`${mention('Member', member.userId)}\`\n\n\`\`\`\nTIP-1\n\`\`\``,
    })
    await runNotifyJobs()
    expect(await isSubscribed(issue.id, member.userId)).toBe(false)
  })
})
