import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { orpc } from '@/lib/orpc'

/** The workspace from the `:workspaceSlug` route param (already membership-checked by the guard). */
export function useCurrentWorkspace() {
  const route = useRoute()
  const slug = computed(() => String(route.params.workspaceSlug ?? ''))
  const query = useQuery(
    computed(() => ({
      ...orpc.workspaces.get.queryOptions({ input: { workspaceSlug: slug.value } }),
      enabled: Boolean(slug.value),
    })),
  )
  return { slug, workspace: query.data, query }
}
