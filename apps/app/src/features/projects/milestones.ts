import type { Milestone, UpdateMilestoneInput } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { invalidateProjects } from './queries'

export { milestonePercent, moveMilestone } from './milestone-list'

export const milestoneListOptions = (workspaceSlug: string, projectId: string) =>
  orpc.milestones.list.queryOptions({ input: { workspaceSlug, projectId } })

export type MilestoneChanges = Omit<UpdateMilestoneInput, 'workspaceSlug' | 'id'>

/**
 * Milestone mutations for one project. Rename, target date and reorder are optimistic
 * (the list cache changes at once and rolls back with a toast); create and delete wait
 * for the server, since the row's id and the issues' counts come from it.
 */
export function useMilestoneMutations(
  workspaceSlug: MaybeRefOrGetter<string>,
  projectId: MaybeRefOrGetter<string>,
) {
  const queryClient = useQueryClient()
  const key = () => milestoneListOptions(toValue(workspaceSlug), toValue(projectId)).queryKey
  const settle = () => invalidateProjects(queryClient)

  async function optimistic(next: (list: Milestone[]) => Milestone[]) {
    await queryClient.cancelQueries({ queryKey: key() })
    const previous = queryClient.getQueryData(key())
    if (previous) queryClient.setQueryData(key(), next(previous))
    return { previous }
  }
  function rollback(context: { previous?: Milestone[] } | undefined) {
    if (context?.previous) queryClient.setQueryData(key(), context.previous)
  }

  const create = useMutation({
    mutationFn: (name: string) =>
      client.milestones.create({
        workspaceSlug: toValue(workspaceSlug),
        projectId: toValue(projectId),
        name,
      }),
    onSuccess: (created) =>
      queryClient.setQueryData(key(), (list) => (list ? [...list, created] : list)),
    onError: (error) => toast.error("Couldn't add milestone", { description: errorMessage(error) }),
    onSettled: settle,
  })

  const update = useMutation({
    mutationFn: ({ milestone, changes }: { milestone: Milestone; changes: MilestoneChanges }) =>
      client.milestones.update({
        workspaceSlug: toValue(workspaceSlug),
        id: milestone.id,
        ...changes,
      }),
    onMutate: ({ milestone, changes }) =>
      optimistic((list) => list.map((m) => (m.id === milestone.id ? { ...m, ...changes } : m))),
    onError: (error, { milestone }, context) => {
      rollback(context)
      toast.error(`Couldn't update ${milestone.name}`, { description: errorMessage(error) })
    },
    onSettled: settle,
  })

  const reorder = useMutation({
    mutationFn: (ordered: Milestone[]) =>
      client.milestones.reorder({
        workspaceSlug: toValue(workspaceSlug),
        projectId: toValue(projectId),
        orderedIds: ordered.map((m) => m.id),
      }),
    onMutate: (ordered) => optimistic(() => ordered),
    onError: (error, _, context) => {
      rollback(context)
      toast.error("Couldn't reorder milestones", { description: errorMessage(error) })
    },
    onSettled: settle,
  })

  const remove = useMutation({
    mutationFn: (milestone: Milestone) =>
      client.milestones.delete({ workspaceSlug: toValue(workspaceSlug), id: milestone.id }),
    onSuccess: ({ id }) =>
      queryClient.setQueryData(key(), (list) => list?.filter((m) => m.id !== id)),
    onError: (error, milestone) =>
      toast.error(`Couldn't delete ${milestone.name}`, { description: errorMessage(error) }),
    // Its issues lose the milestone: refetch them too.
    onSettled: () =>
      Promise.all([settle(), queryClient.invalidateQueries({ queryKey: orpc.issues.key() })]),
  })

  return { create, update, reorder, remove }
}
