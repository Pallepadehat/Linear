import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from '../harness'

// Authorization matrix (OWASP A01 Broken Access Control): anonymous, stranger (other
// workspace), member and owner against the same resources.
const { app } = await setupTestApp()

async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { team } = await owner.client.workspaces.create({
    name: 'Tip',
    slug: 'tip',
    team: { name: 'Tip', key: 'TIP' },
  })
  const issue = await owner.client.issues.create({
    workspaceSlug: 'tip',
    teamId: team!.id,
    title: 'Secret roadmap',
  })
  const { code } = await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })
  const member = await signUp(app, 'Member')
  await member.client.workspaces.join({ code: code! })

  const stranger = await signUp(app, 'Stranger')
  await stranger.client.workspaces.create({
    name: 'Other',
    slug: 'other',
    team: { name: 'Other', key: 'OTH' },
  })
  return { owner, member, stranger, team: team!, issue }
}

describe('security: access control', () => {
  it('requires a session for every workspace procedure', async () => {
    const { issue } = await arrange()
    const anonymous = rpcClient(app)
    await expect(anonymous.workspaces.get({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    await expect(
      anonymous.issues.get({ workspaceSlug: 'tip', id: issue.id }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('hides another workspace behind NOT_FOUND, so its existence cannot be probed', async () => {
    const { stranger } = await arrange()
    await expect(stranger.client.workspaces.get({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(stranger.client.issues.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('blocks IDOR: a known issue id from another workspace is useless', async () => {
    const { stranger, issue } = await arrange()
    // The stranger asks through *their own* workspace for the other workspace's issue id.
    await expect(
      stranger.client.issues.get({ workspaceSlug: 'other', id: issue.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.issues.update({ workspaceSlug: 'other', id: issue.id, title: 'pwned' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.issues.delete({ workspaceSlug: 'other', id: issue.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lets members work on issues but keeps owner-only settings for the owner', async () => {
    const { owner, member, issue } = await arrange()

    expect(await member.client.issues.get({ workspaceSlug: 'tip', id: issue.id })).toMatchObject({
      title: 'Secret roadmap',
    })
    await expect(
      member.client.workspaces.resetInvite({ workspaceSlug: 'tip' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      member.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', defaultPriority: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // The owner can do both.
    expect(await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })).toMatchObject({
      code: expect.any(String),
    })
  })

  it('never returns password hashes or tokens in member lists', async () => {
    const { owner } = await arrange()
    const members = await owner.client.workspaces.listMembers({ workspaceSlug: 'tip' })
    expect(JSON.stringify(members)).not.toMatch(/password|token|[0-9a-f]{32}:[0-9a-f]{128}/i)
  })
})
