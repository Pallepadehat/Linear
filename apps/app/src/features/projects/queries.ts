import type { Project, UpdateProjectInput } from '@linear/contract'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'

export const projectListOptions = (workspaceSlug: string) =>
  orpc.projects.list.queryOptions({ input: { workspaceSlug } })

export const projectOptions = (workspaceSlug: string, id: string) =>
  orpc.projects.get.queryOptions({ input: { workspaceSlug, id } })

/** The Progress card; under `projects.key()`, so issue and project changes refetch it. */
export const projectProgressOptions = (workspaceSlug: string, projectId: string) =>
  orpc.projects.progress.queryOptions({ input: { workspaceSlug, projectId } })

export const projectLabelListOptions = (workspaceSlug: string) =>
  orpc.projectLabels.list.queryOptions({ input: { workspaceSlug } })

/** Matches every project query (list and detail); progress depends on issue changes. */
export const projectsKey = () => orpc.projects.key()

/** Matches every milestone list; milestone progress depends on issue changes too. */
export const milestonesKey = () => orpc.milestones.key()

/** Refetches project and milestone progress (both count issues by status and project). */
export function invalidateProjects(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: projectsKey() }),
    queryClient.invalidateQueries({ queryKey: milestonesKey() }),
  ])
}

/** Writes a saved project into the detail and list caches. */
export function storeProject(queryClient: QueryClient, workspaceSlug: string, project: Project) {
  queryClient.setQueryData(projectOptions(workspaceSlug, project.id).queryKey, project)
  queryClient.setQueryData(projectListOptions(workspaceSlug).queryKey, (list) =>
    list?.some((p) => p.id === project.id)
      ? list.map((p) => (p.id === project.id ? project : p))
      : list,
  )
}

export type ProjectChanges = Omit<UpdateProjectInput, 'workspaceSlug' | 'id'>

/** The cached project with `changes` applied, as the server will return it. */
export function applyProjectChanges(project: Project, changes: ProjectChanges): Project {
  const { iconUploadId, ...rest } = changes
  const next: Project = { ...project, ...rest }
  // The new icon's URL only comes back from the server.
  if (iconUploadId !== undefined) next.iconUploadId = iconUploadId
  if (iconUploadId === null) next.iconUrl = null
  return next
}

/**
 * Saves project property changes optimistically: the list and detail caches update at
 * once and roll back with a toast if the server rejects the change.
 */
export function useUpdateProject(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const mutationKey = orpc.projects.update.mutationKey()
  return useMutation({
    mutationKey,
    mutationFn: ({ project, changes }: { project: Project; changes: ProjectChanges }) =>
      client.projects.update({ workspaceSlug: toValue(workspaceSlug), id: project.id, ...changes }),
    onMutate: async ({ project, changes }) => {
      const slug = toValue(workspaceSlug)
      const listKey = projectListOptions(slug).queryKey
      const detailKey = projectOptions(slug, project.id).queryKey
      // A refetch landing after the patch would overwrite it with stale data.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ])
      const previous = {
        list: queryClient.getQueryData(listKey),
        detail: queryClient.getQueryData(detailKey),
      }
      const current = previous.detail ?? previous.list?.find((p) => p.id === project.id) ?? project
      storeProject(queryClient, slug, applyProjectChanges(current, changes))
      return { previous, listKey, detailKey }
    },
    onError: (error, { project }, context) => {
      if (context) {
        queryClient.setQueryData(context.listKey, context.previous.list)
        queryClient.setQueryData(context.detailKey, context.previous.detail)
      }
      toast.error(`Couldn't update ${project.name}`, { description: errorMessage(error) })
    },
    onSuccess: (saved) => storeProject(queryClient, toValue(workspaceSlug), saved),
    onSettled: () => {
      // With several changes in flight, refetching after the first would briefly
      // show the server state without the later ones; wait for the last.
      if (queryClient.isMutating({ mutationKey }) > 1) return
      return invalidateProjects(queryClient)
    },
  })
}
