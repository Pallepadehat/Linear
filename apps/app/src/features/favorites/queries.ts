import type { Favorite } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import {
  findFavorite,
  isPending,
  PENDING_PREFIX,
  type FavoriteRef,
  type FavoriteTarget,
} from './favorite-list'

export const favoriteListOptions = (workspaceSlug: string) =>
  orpc.favorites.list.queryOptions({ input: { workspaceSlug } })

/**
 * Shared optimistic plumbing: apply `update` to the cached list, roll back with a toast on error,
 * and refetch afterwards. Favorites are personal, so nothing is broadcast to the workspace.
 */
function useFavoriteMutation<V>(
  workspaceSlug: MaybeRefOrGetter<string>,
  options: {
    mutationFn: (slug: string, variables: V) => Promise<unknown>
    update: (list: Favorite[], variables: V) => Favorite[]
    errorTitle: string
  },
) {
  const queryClient = useQueryClient()
  const key = () => favoriteListOptions(toValue(workspaceSlug)).queryKey
  return useMutation({
    mutationFn: (variables: V) => options.mutationFn(toValue(workspaceSlug), variables),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key() })
      const previous = queryClient.getQueryData(key())
      queryClient.setQueryData(key(), (list) => options.update(list ?? [], variables))
      return { previous }
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(key(), context?.previous)
      toast.error(options.errorTitle, { description: errorMessage(error) })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key() }),
  })
}

export function useAddFavorite(workspaceSlug: MaybeRefOrGetter<string>) {
  return useFavoriteMutation(workspaceSlug, {
    mutationFn: (slug, target: FavoriteTarget) =>
      client.favorites.add({
        workspaceSlug: slug,
        entityType: target.entityType,
        entityId: target.entityId,
      }),
    // A temporary id until the refetch brings the real one; new favorites go last.
    update: (list, target) =>
      findFavorite(list, target)
        ? list
        : [...list, { ...target, id: `${PENDING_PREFIX}${target.entityId}` }],
    errorTitle: "Couldn't add to favorites",
  })
}

export function useRemoveFavorite(workspaceSlug: MaybeRefOrGetter<string>) {
  return useFavoriteMutation(workspaceSlug, {
    mutationFn: (slug, favorite: Favorite) =>
      client.favorites.remove({ workspaceSlug: slug, id: favorite.id }),
    update: (list, favorite) => list.filter((f) => f.id !== favorite.id),
    errorTitle: "Couldn't remove from favorites",
  })
}

export function useReorderFavorites(workspaceSlug: MaybeRefOrGetter<string>) {
  return useFavoriteMutation(workspaceSlug, {
    mutationFn: (slug, ordered: Favorite[]) =>
      client.favorites.reorder({ workspaceSlug: slug, ids: ordered.map((f) => f.id) }),
    update: (_list, ordered) => ordered,
    errorTitle: "Couldn't reorder favorites",
  })
}

/** Star state for one entity plus a toggle (the header star, ⌥F and "…" menus share it). */
export function useToggleFavorite(workspaceSlug: MaybeRefOrGetter<string>) {
  const { data: list } = useQuery(computed(() => favoriteListOptions(toValue(workspaceSlug))))
  const add = useAddFavorite(workspaceSlug)
  const remove = useRemoveFavorite(workspaceSlug)

  function isFavorite(ref: FavoriteRef) {
    return Boolean(findFavorite(list.value, ref))
  }
  function toggle(target: FavoriteTarget) {
    const existing = findFavorite(list.value, target)
    if (!existing) add.mutate(target)
    // Still being added; the next toggle after the refetch removes it.
    else if (!isPending(existing)) remove.mutate(existing)
  }
  return { list, isFavorite, toggle }
}
