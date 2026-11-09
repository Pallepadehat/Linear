import { REALTIME_CLIENT_ID_HEADER, type ContractClient } from '@linear/contract'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { apiBase } from './api-base'
import { clientId } from './client-id'

const link = new RPCLink({
  url: `${apiBase}/rpc`,
  headers: { [REALTIME_CLIENT_ID_HEADER]: clientId },
  fetch: (request, init) => fetch(request, { ...init, credentials: 'include' }),
})

export const client: ContractClient = createORPCClient(link)

/** Query/mutation options and keys for every procedure: `orpc.me.get.queryOptions()`. */
export const orpc = createTanstackQueryUtils(client)
