import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from '../harness'

// PRD §12 Test 2. Validation and completedAt rules: ../issues.test.ts → issues procedures.
const { app, db } = await setupTestApp()

describe('acceptance: 2 issue editing', () => {
  it('persists priority, assignee and status changes', async () => {
    const owner = await signUp(app, 'Owner')
    const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
    const assignee = await signUp(app, 'Assignee')
    await addMember(db, workspace.id, assignee.userId)
    const inProgress = team.statuses.find((s) => s.name === 'In Progress')!
    const { id } = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Fix login',
    })

    await owner.client.issues.update({
      workspaceSlug: 'tip',
      id,
      priority: 2,
      assigneeId: assignee.userId,
      statusId: inProgress.id,
    })

    // Read back through another member's session: the change is stored, not just echoed.
    expect(await assignee.client.issues.get({ workspaceSlug: 'tip', id })).toMatchObject({
      priority: 2,
      assigneeId: assignee.userId,
      status: inProgress,
    })
  })
})
