import type { LinkFields, ProjectLink } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'

export const projectLinkListOptions = (workspaceSlug: string, projectId: string) =>
  orpc.projectLinks.list.queryOptions({ input: { workspaceSlug, projectId } })

/**
 * A project's Resources mutations. Create waits for the server (the row's id and hostname
 * come from it); edit and remove are optimistic and roll back with a toast.
 */
export function useProjectLinkMutations(
  workspaceSlug: MaybeRefOrGetter<string>,
  projectId: MaybeRefOrGetter<string>,
) {
  const queryClient = useQueryClient()
  const key = () => projectLinkListOptions(toValue(workspaceSlug), toValue(projectId)).queryKey
  const settle = () => queryClient.invalidateQueries({ queryKey: key() })

  async function optimistic(next: (list: ProjectLink[]) => ProjectLink[]) {
    await queryClient.cancelQueries({ queryKey: key() })
    const previous = queryClient.getQueryData(key())
    if (previous) queryClient.setQueryData(key(), next(previous))
    return { previous }
  }
  function rollback(
    context: { previous?: ProjectLink[] } | undefined,
    message: string,
    error: Error,
  ) {
    if (context?.previous) queryClient.setQueryData(key(), context.previous)
    toast.error(message, { description: errorMessage(error) })
  }

  const create = useMutation({
    mutationFn: (fields: LinkFields) =>
      client.projectLinks.create({
        workspaceSlug: toValue(workspaceSlug),
        projectId: toValue(projectId),
        ...fields,
      }),
    onSuccess: (link) =>
      queryClient.setQueryData(key(), (list) => (list ? [...list, link] : [link])),
    onSettled: settle,
  })

  const update = useMutation({
    mutationFn: ({ link, fields }: { link: ProjectLink; fields: LinkFields }) =>
      client.projectLinks.update({
        workspaceSlug: toValue(workspaceSlug),
        id: link.id,
        url: fields.url,
        title: fields.title ?? '',
      }),
    onMutate: ({ link, fields }) =>
      // The server resolves an empty title to the hostname; show the old one until then.
      optimistic((list) =>
        list.map((l) =>
          l.id === link.id
            ? { ...l, url: fields.url, title: fields.title?.trim() || l.hostname }
            : l,
        ),
      ),
    onError: (error, _vars, context) => rollback(context, "Couldn't update the link", error),
    onSettled: settle,
  })

  const remove = useMutation({
    mutationFn: (link: ProjectLink) =>
      client.projectLinks.delete({ workspaceSlug: toValue(workspaceSlug), id: link.id }),
    onMutate: (link) => optimistic((list) => list.filter((l) => l.id !== link.id)),
    onError: (error, _link, context) => rollback(context, "Couldn't remove the link", error),
    onSettled: settle,
  })

  return { create, update, remove }
}
