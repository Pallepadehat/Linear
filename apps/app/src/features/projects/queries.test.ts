// @vitest-environment happy-dom
import type { Project } from '@linear/contract'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type * as Orpc from '@/lib/orpc'
import { projectListOptions, projectOptions, useUpdateProject } from './queries'

const update = vi.hoisted(() => vi.fn())
vi.mock('@/lib/orpc', async (importOriginal) => {
  const actual = await importOriginal<typeof Orpc>()
  return { ...actual, client: { projects: { update } } }
})
const toastError = vi.hoisted(() => vi.fn())
vi.mock('vue-sonner', () => ({ toast: { error: toastError } }))

const project: Project = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Launch',
  description: null,
  status: 'planned',
  iconUploadId: null,
  iconUrl: null,
  teamIds: [],
  priority: 0,
  leadId: null,
  memberIds: [],
  startDate: null,
  targetDate: null,
  labelIds: [],
  progress: { completed: 0, total: 0 },
  issueCount: 0,
  currentMilestone: null,
  createdAt: new Date(0),
}

function setup() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(projectListOptions('tip').queryKey, [project])
  queryClient.setQueryData(projectOptions('tip', project.id).queryKey, project)
  let mutation!: ReturnType<typeof useUpdateProject>
  const app = createApp({
    setup() {
      mutation = useUpdateProject('tip')
      return () => null
    },
  })
  app.use(VueQueryPlugin, { queryClient })
  app.mount(document.createElement('div'))
  const cached = () => ({
    list: queryClient.getQueryData(projectListOptions('tip').queryKey)?.[0],
    detail: queryClient.getQueryData(projectOptions('tip', project.id).queryKey),
  })
  return { mutation, cached, unmount: () => app.unmount() }
}

afterEach(() => vi.clearAllMocks())

describe('useUpdateProject', () => {
  it('applies a change to the list and detail caches before the server answers', async () => {
    let resolve!: (value: Project) => void
    update.mockReturnValue(new Promise<Project>((r) => (resolve = r)))
    const { mutation, cached, unmount } = setup()

    const done = mutation.mutateAsync({
      project,
      changes: { priority: 1, targetDate: '2026-12-01' },
    })
    await vi.waitFor(() => expect(cached().list).toMatchObject({ priority: 1 }))
    expect(cached().detail).toMatchObject({ priority: 1, targetDate: '2026-12-01' })
    expect(update).toHaveBeenCalledWith({
      workspaceSlug: 'tip',
      id: project.id,
      priority: 1,
      targetDate: '2026-12-01',
    })

    resolve({ ...project, priority: 1, targetDate: '2026-12-01', issueCount: 3 })
    await done
    expect(cached().list).toMatchObject({ priority: 1, issueCount: 3 })
    unmount()
  })

  it('rolls back and shows a toast when the server rejects the change', async () => {
    update.mockRejectedValue(new Error('Lead not found'))
    const { mutation, cached, unmount } = setup()

    await expect(
      mutation.mutateAsync({ project, changes: { leadId: crypto.randomUUID() } }),
    ).rejects.toThrow()
    expect(cached()).toEqual({ list: project, detail: project })
    expect(toastError).toHaveBeenCalledWith("Couldn't update Launch", expect.anything())
    unmount()
  })
})
