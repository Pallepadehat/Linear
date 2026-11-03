import type { UpdateViewInput, View } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { favoriteListOptions } from '@/features/favorites/queries'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'

/** Only that team's views with `teamId`; otherwise every view the user can see. */
export const viewListOptions = (workspaceSlug: string, teamId?: string) =>
  orpc.views.list.queryOptions({ input: { workspaceSlug, teamId } })

export const viewOptions = (workspaceSlug: string, id: string) =>
  orpc.views.get.queryOptions({ input: { workspaceSlug, id } })

/** Matches every view query, for invalidation (mutations and realtime). */
export const viewsKey = () => orpc.views.key()

export type ViewChanges = Omit<UpdateViewInput, 'workspaceSlug' | 'id'>

/** Applies `changes` to one view in every cached list and its own query. */
function patchCachedView(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  view: View,
) {
  queryClient.setQueryData(viewOptions(workspaceSlug, view.id).queryKey, view)
  queryClient.setQueriesData<View[]>({ queryKey: orpc.views.list.key() }, (list) =>
    list?.map((v) => (v.id === view.id ? view : v)),
  )
}

/**
 * Saves a view optimistically: the page stops showing unsaved changes at once, and the
 * cache rolls back with a toast if the server refuses.
 */
export function useUpdateView(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ view, changes }: { view: View; changes: ViewChanges }) =>
      client.views.update({ workspaceSlug: toValue(workspaceSlug), id: view.id, ...changes }),
    onMutate: async ({ view, changes }) => {
      const slug = toValue(workspaceSlug)
      await queryClient.cancelQueries({ queryKey: viewsKey() })
      const { filters, display, ...rest } = changes
      // Stored filters drop unset fields, so the optimistic copy replaces them whole.
      patchCachedView(queryClient, slug, {
        ...view,
        ...rest,
        ...(filters && { filters: filters as View['filters'] }),
        ...(display && { display }),
      })
      return { previous: view }
    },
    onError: (error, _variables, context) => {
      if (context) patchCachedView(queryClient, toValue(workspaceSlug), context.previous)
      toast.error("Couldn't save the view", { description: errorMessage(error) })
    },
    onSuccess: (view) => patchCachedView(queryClient, toValue(workspaceSlug), view),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: viewsKey() })
      // Favorites show the view's name and icon.
      void queryClient.invalidateQueries({
        queryKey: favoriteListOptions(toValue(workspaceSlug)).queryKey,
      })
    },
  })
}

export function useDeleteView(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (view: View) =>
      client.views.delete({ workspaceSlug: toValue(workspaceSlug), id: view.id }),
    onSuccess: (_result, view) => {
      queryClient.setQueriesData<View[]>({ queryKey: orpc.views.list.key() }, (list) =>
        list?.filter((v) => v.id !== view.id),
      )
      toast.success(`Deleted “${view.name}”`)
    },
    onError: (error) =>
      toast.error("Couldn't delete the view", { description: errorMessage(error) }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.views.list.key() })
      void queryClient.invalidateQueries({
        queryKey: favoriteListOptions(toValue(workspaceSlug)).queryKey,
      })
    },
  })
}
