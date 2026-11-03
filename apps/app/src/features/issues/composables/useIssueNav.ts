import type { IssuePage } from '@linear/contract'
import { hashKey, useQueryClient, type InfiniteData } from '@tanstack/vue-query'
import { onKeyStroke } from '@vueuse/core'
import { computed, onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'
import { isTypingTarget } from '@/lib/keyboard'
import { useIssueNavStore } from '@/stores/issue-nav'

/**
 * Prev/next through the list the issue was opened from: keeps the context only
 * for issues reached from it, keeps its order in step with the list's cache, and
 * binds J/K. Steps replace the history entry so Back returns to the list.
 */
export function useIssueNav(identifier: MaybeRefOrGetter<string>) {
  const nav = useIssueNavStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  watch(() => toValue(identifier), nav.enter, { immediate: true })

  // The list is unmounted while the detail page shows, so its query is inactive:
  // realtime invalidation only marks it stale. Refetch it here, and re-derive the
  // order whenever its data changes (refetches and optimistic edits alike).
  const sourceHash = computed(() => (nav.source ? hashKey(nav.source.queryKey) : null))
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryHash !== sourceHash.value) return
    if (event.action.type === 'invalidate') {
      void queryClient.refetchQueries({
        queryKey: event.query.queryKey,
        exact: true,
        type: 'inactive',
      })
      return
    }
    const data = queryClient.getQueryData<InfiniteData<IssuePage>>(event.query.queryKey)
    if (event.action.type === 'success' && data) nav.refresh(data.pages.flatMap((p) => p.items))
  })
  onScopeDispose(unsubscribe)

  function go(delta: 1 | -1) {
    const next = nav.step(delta)
    if (next) void router.replace({ name: 'issue', params: { identifier: next } })
  }

  onKeyStroke(['j', 'k'], (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
    if (!nav.position) return
    event.preventDefault()
    go(event.key === 'j' ? 1 : -1)
  })

  return {
    position: computed(() => nav.position),
    hasNext: computed(() => nav.neighbor(1) !== null),
    hasPrevious: computed(() => nav.neighbor(-1) !== null),
    next: () => go(1),
    previous: () => go(-1),
    /** The list the issue was opened from, if any. */
    sourceRoute: computed(() => nav.source?.route ?? null),
  }
}
