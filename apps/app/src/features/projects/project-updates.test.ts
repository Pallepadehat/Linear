import type { ProjectUpdate } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { projectUpdateRow } from './project-updates'

const update: ProjectUpdate = {
  id: '00000000-0000-7000-8000-000000000001',
  projectId: '00000000-0000-7000-8000-000000000002',
  author: { id: 'author', name: 'Ada', avatarUrl: null },
  health: 'at_risk',
  body: 'Slipping',
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

describe('projectUpdateRow', () => {
  it('lets the author edit and delete', () => {
    expect(projectUpdateRow(update, { userId: 'author', role: 'member' })).toMatchObject({
      authorName: 'Ada',
      health: 'at_risk',
      canEdit: true,
      canDelete: true,
    })
  })

  it('lets a workspace owner delete, but not edit, someone else’s update', () => {
    expect(projectUpdateRow(update, { userId: 'owner', role: 'owner' })).toMatchObject({
      canEdit: false,
      canDelete: true,
    })
  })

  it('gives other members neither, nor anyone before the session loads', () => {
    expect(projectUpdateRow(update, { userId: 'other', role: 'member' })).toMatchObject({
      canEdit: false,
      canDelete: false,
    })
    expect(projectUpdateRow(update, { userId: undefined, role: undefined })).toMatchObject({
      canEdit: false,
      canDelete: false,
    })
  })
})
