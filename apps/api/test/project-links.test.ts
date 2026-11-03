import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }

async function tipWithProject() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const project = await owner.client.projects.create({ ...scope, name: 'Launch' })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  return { owner, member, project }
}

async function outsiderProject() {
  const outsider = await signUp(app, 'Outsider')
  await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
  const project = await outsider.client.projects.create({ workspaceSlug: 'other', name: 'Theirs' })
  const link = await outsider.client.projectLinks.create({
    workspaceSlug: 'other',
    projectId: project.id,
    url: 'https://example.com/theirs',
  })
  return { outsider, project, link }
}

describe('project links', () => {
  it('creates in order, lists, updates and deletes links', async () => {
    const { member, project } = await tipWithProject()
    const spec = await member.client.projectLinks.create({
      ...scope,
      projectId: project.id,
      url: 'https://www.notion.so/spec',
      title: '  Spec ',
    })
    expect(spec).toEqual({
      id: expect.any(String),
      projectId: project.id,
      url: 'https://www.notion.so/spec',
      title: 'Spec',
      hostname: 'notion.so',
      createdAt: expect.any(Date),
    })
    const figma = await member.client.projectLinks.create({
      ...scope,
      projectId: project.id,
      url: 'https://figma.com/file/1',
    })
    expect(figma.title).toBe('figma.com')
    expect(await member.client.projectLinks.list({ ...scope, projectId: project.id })).toEqual([
      spec,
      figma,
    ])

    // A hostname title follows the new URL; a custom title stays.
    const moved = await member.client.projectLinks.update({
      ...scope,
      id: figma.id,
      url: 'https://docs.example.dev/x',
    })
    expect(moved).toMatchObject({ title: 'docs.example.dev', hostname: 'docs.example.dev' })
    const renamed = await member.client.projectLinks.update({ ...scope, id: spec.id, title: 'PRD' })
    expect(renamed.title).toBe('PRD')

    expect(await member.client.projectLinks.delete({ ...scope, id: spec.id })).toEqual({
      id: spec.id,
    })
    expect(await member.client.projectLinks.list({ ...scope, projectId: project.id })).toEqual([
      moved,
    ])
  })

  it.each(['javascript:alert(1)', 'ftp://example.com/file', 'not a url'])(
    'rejects %s with BAD_REQUEST',
    async (url) => {
      const { owner, project } = await tipWithProject()
      await expect(
        owner.client.projectLinks.create({ ...scope, projectId: project.id, url }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      const link = await owner.client.projectLinks.create({
        ...scope,
        projectId: project.id,
        url: 'https://example.com',
      })
      await expect(
        owner.client.projectLinks.update({ ...scope, id: link.id, url }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    },
  )

  it('returns NOT_FOUND for projects and links in another workspace', async () => {
    const { owner } = await tipWithProject()
    const { outsider, project, link } = await outsiderProject()
    const projectId = project.id

    await expect(owner.client.projectLinks.list({ ...scope, projectId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      owner.client.projectLinks.create({ ...scope, projectId, url: 'https://example.com' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      owner.client.projectLinks.update({ ...scope, id: link.id, title: 'Mine' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(owner.client.projectLinks.delete({ ...scope, id: link.id })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    )
    // Non-members can't reach the other workspace at all.
    await expect(
      owner.client.projectLinks.list({ workspaceSlug: 'other', projectId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(
      await outsider.client.projectLinks.list({ workspaceSlug: 'other', projectId }),
    ).toMatchObject([{ id: link.id, title: 'example.com' }])
  })

  it('deletes links with their project', async () => {
    const { owner, project } = await tipWithProject()
    await owner.client.projectLinks.create({
      ...scope,
      projectId: project.id,
      url: 'https://example.com',
    })
    await owner.client.projects.delete({ ...scope, id: project.id })
    await expect(
      owner.client.projectLinks.list({ ...scope, projectId: project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('project summary', () => {
  it('sets, trims and clears the summary', async () => {
    const { owner, project } = await tipWithProject()
    expect(project.summary).toBeNull()
    const saved = await owner.client.projects.update({
      ...scope,
      id: project.id,
      summary: '  Ship the beta ',
    })
    expect(saved.summary).toBe('Ship the beta')
    expect((await owner.client.projects.get({ ...scope, id: project.id })).summary).toBe(
      'Ship the beta',
    )
    expect(
      (await owner.client.projects.update({ ...scope, id: project.id, summary: '   ' })).summary,
    ).toBeNull()
    await expect(
      owner.client.projects.update({ ...scope, id: project.id, summary: 'x'.repeat(256) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
