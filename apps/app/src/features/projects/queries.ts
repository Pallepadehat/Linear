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

/** The latest entries of a project's feed (newest first), for the Activity card. */
export const projectActivityPreviewOptions = (workspaceSlug: string, projectId: string) =>
  orpc.projects.activity.queryOptions({ input: { workspaceSlug, projectId, limit: 5 } })

/** Newest-first pages of a project's feed, for the full Activity view. */
export const projectActivityListOptions = (workspaceSlug: string, projectId: string) =>
  orpc.projects.activity.infiniteOptions({
    input: (cursor: string | null) => ({ workspaceSlug, projectId, cursor, limit: 50 }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
  })

/** The latest update (its health and body), for the Overview card. */
export const projectLatestUpdateOptions = (workspaceSlug: string, projectId: string) =>
  orpc.projectUpdates.list.queryOptions({ input: { workspaceSlug, projectId, limit: 1 } })

/** Newest-first pages of a project's updates, for the Activity tab. */
export const projectUpdateListOptions = (workspaceSlug: string, projectId: string) =>
  orpc.projectUpdates.list.infiniteOptions({
    input: (cursor: string | null) => ({ workspaceSlug, projectId, cursor, limit: 20 }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
  })

/** Matches every project query (list, detail and activity); progress depends on issue changes. */
export const projectsKey = () => orpc.projects.key()

/** Matches every milestone list; milestone progress depends on issue changes too. */
export const milestonesKey = () => orpc.milestones.key()

/**
 * Refetches project and milestone progress (both count issues by status and project) and,
 * since `project.updated` also covers them, the project's resource links and updates.
 */
export function invalidateProjects(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: projectsKey() }),
    queryClient.invalidateQueries({ queryKey: milestonesKey() }),
    queryClient.invalidateQueries({ queryKey: orpc.projectLinks.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.projectUpdates.key() }),
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

/**
 * Posting, editing and deleting project updates. Not optimistic: an update changes the
 * project's health, which only the server derives, so each refetches the project queries.
 */
export function useProjectUpdateActions() {
  const queryClient = useQueryClient()
  const onError = (title: string) => (error: unknown) =>
    toast.error(title, { description: errorMessage(error) })
  const onSettled = () => invalidateProjects(queryClient)
  return {
    create: useMutation(
      orpc.projectUpdates.create.mutationOptions({
        onError: onError("Couldn't post the update"),
        onSettled,
      }),
    ),
    update: useMutation(
      orpc.projectUpdates.update.mutationOptions({
        onError: onError("Couldn't save the update"),
        onSettled,
      }),
    ),
    remove: useMutation(
      orpc.projectUpdates.delete.mutationOptions({
        onError: onError("Couldn't delete the update"),
        onSettled,
      }),
    ),
  }
}
