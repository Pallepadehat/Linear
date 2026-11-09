import type { Label, UpdateLabelInput } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { errorCode, errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { issueDetailKeys, issueFacetsKey, issueListKey } from '@/features/issues/queries'
import { findLabelByName } from './label-options'

/** Workspace labels plus `teamId`'s; without a team, every label in the workspace. */
export const labelListOptions = (workspaceSlug: string, teamId?: string) =>
  orpc.labels.list.queryOptions({ input: { workspaceSlug, teamId } })

/** Matches every label list, for invalidation. */
export const labelListKey = () => orpc.labels.list.key()

export type CreateLabelVariables = {
  workspaceSlug: string
  teamId: string | null
  name: string
  color: string
}

/**
 * Creates a label. A `CONFLICT` means someone else just created the same name in
 * this scope, so the existing label is returned instead (docs/domain.md → Labels).
 */
export function useCreateLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateLabelVariables): Promise<Label> => {
      try {
        return await client.labels.create(input)
      } catch (error) {
        if (errorCode(error) !== 'CONFLICT') throw error
        const labels = await client.labels.list({
          workspaceSlug: input.workspaceSlug,
          teamId: input.teamId ?? undefined,
        })
        const existing = findLabelByName(
          labels.filter((label) => label.teamId === input.teamId),
          input.name,
        )
        if (!existing) throw error
        return existing
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: labelListKey() }),
  })
}

/** Issues embed label names and colors, so label edits refresh them too. */
function invalidateLabelUsers(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: labelListKey() }),
    queryClient.invalidateQueries({ queryKey: issueListKey() }),
    queryClient.invalidateQueries({ queryKey: issueFacetsKey() }),
    ...issueDetailKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ])
}

export function useUpdateLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateLabelInput) => client.labels.update(input),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => invalidateLabelUsers(queryClient),
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { workspaceSlug: string; id: string }) => client.labels.delete(input),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => invalidateLabelUsers(queryClient),
  })
}
