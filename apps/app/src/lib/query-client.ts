import { QueryClient } from '@tanstack/vue-query'
import { errorCode } from './errors'

const NO_RETRY = new Set(['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST', 'CONFLICT'])

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !NO_RETRY.has(errorCode(error) ?? '') && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})
