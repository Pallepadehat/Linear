import type { Router } from 'vue-router'
import { fetchCurrentUser } from '@/features/auth/composables/useSession'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { queryClient } from '@/lib/query-client'
import { usePreferencesStore } from '@/stores/preferences'

declare module 'vue-router' {
  interface RouteMeta {
    /** Signed-in users only. */
    requiresAuth?: boolean
    /** Signed-out users only (login, register). */
    guestOnly?: boolean
    /** Page title shown in the header and the browser tab. */
    title?: string
  }
}

export function installGuards(router: Router) {
  router.beforeEach(async (to) => {
    const needsUser = to.matched.some((r) => r.meta.requiresAuth || r.meta.guestOnly)
    if (!needsUser) return true

    const user = await fetchCurrentUser()
    if (to.matched.some((r) => r.meta.requiresAuth) && !user) {
      return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
    }
    if (to.matched.some((r) => r.meta.guestOnly) && user) return { name: 'home' }

    const slug = to.params.workspaceSlug
    if (typeof slug === 'string') {
      const preferences = usePreferencesStore()
      try {
        await queryClient.fetchQuery(
          orpc.workspaces.get.queryOptions({ input: { workspaceSlug: slug } }),
        )
        preferences.lastWorkspaceSlug = slug
      } catch (error) {
        // Unknown or foreign workspace: fall back to one the user can see.
        if (errorCode(error) !== 'NOT_FOUND' && errorCode(error) !== 'BAD_REQUEST') throw error
        if (preferences.lastWorkspaceSlug === slug) preferences.lastWorkspaceSlug = null
        return { name: 'home' }
      }
    }
    return true
  })

  router.afterEach((to) => {
    const title = [...to.matched].reverse().find((r) => r.meta.title)?.meta.title
    document.title = title ? `${title} · Linear` : 'Linear'
  })
}
