import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { authClient } from '@/lib/auth-client'
import { errorCode } from '@/lib/errors'
import { queryClient } from '@/lib/query-client'
import { orpc } from '@/lib/orpc'

/**
 * The signed-in user, or null. Backed by `me.get` so the session lives in
 * TanStack Query like all other server state.
 */
export async function fetchCurrentUser() {
  try {
    return await queryClient.fetchQuery({ ...orpc.me.get.queryOptions(), staleTime: 60_000 })
  } catch (error) {
    if (errorCode(error) === 'UNAUTHORIZED') return null
    throw error
  }
}

export function useCurrentUser() {
  return useQuery(orpc.me.get.queryOptions())
}

export function useSignOut() {
  const client = useQueryClient()
  return async () => {
    await authClient.signOut()
    // Drop every cached query so the next user starts clean.
    client.clear()
  }
}
