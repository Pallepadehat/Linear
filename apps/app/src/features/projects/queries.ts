import type { Project } from '@linear/contract'
import type { QueryClient } from '@tanstack/vue-query'
import { orpc } from '@/lib/orpc'

export const projectListOptions = (workspaceSlug: string) =>
  orpc.projects.list.queryOptions({ input: { workspaceSlug } })

export const projectOptions = (workspaceSlug: string, id: string) =>
  orpc.projects.get.queryOptions({ input: { workspaceSlug, id } })

/** Matches every project query (list and detail); progress depends on issue changes. */
export const projectsKey = () => orpc.projects.key()

/** Writes a saved project into the detail and list caches. */
export function storeProject(queryClient: QueryClient, workspaceSlug: string, project: Project) {
  queryClient.setQueryData(projectOptions(workspaceSlug, project.id).queryKey, project)
  queryClient.setQueryData(projectListOptions(workspaceSlug).queryKey, (list) =>
    list?.some((p) => p.id === project.id)
      ? list.map((p) => (p.id === project.id ? project : p))
      : list,
  )
}
