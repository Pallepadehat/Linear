import type { Issue } from '@linear/contract'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

/** The list or board an issue was opened from, for the detail page's "1 / 47" and J/K. */
export type IssueNavSource = {
  /** The source list's infinite query key; its cache updates refresh `identifiers`. */
  queryKey: readonly unknown[]
  /** Issue identifiers in the order the list rendered them (after grouping and ordering). */
  identifiers: string[]
  /** Re-derives `identifiers` from the list's cached issues, grouped and ordered as rendered. */
  order: (issues: Issue[]) => string[]
  /** The source list's full path (with its filters), for the breadcrumb and after Delete. */
  route: string
}

const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase()

/**
 * Prev/next navigation context for the issue detail page. A list sets it when an
 * issue is opened from it; opening an issue any other way (URL, search) clears it.
 */
export const useIssueNavStore = defineStore('issueNav', () => {
  const source = shallowRef<IssueNavSource | null>(null)
  /** The issue the context was opened for or last stepped to; any other issue clears it. */
  const current = shallowRef<string | null>(null)

  function open(next: IssueNavSource, identifier: string) {
    source.value = next
    current.value = identifier
  }

  function clear() {
    source.value = null
    current.value = null
  }

  /** Called whenever the detail page shows `identifier`: keeps the context only if it led here. */
  function enter(identifier: string) {
    if (!current.value || !same(current.value, identifier)) clear()
  }

  /** The list's issues changed in the cache (realtime, edits, a deleted issue). */
  function refresh(issues: Issue[]) {
    if (source.value) source.value = { ...source.value, identifiers: source.value.order(issues) }
  }

  const index = computed(() => {
    const at = current.value
    return at && source.value ? source.value.identifiers.findIndex((id) => same(id, at)) : -1
  })

  /** 1-based position and total, or null when there is no context or the issue left the list. */
  const position = computed(() =>
    source.value && index.value >= 0
      ? { index: index.value + 1, total: source.value.identifiers.length }
      : null,
  )

  /** The identifier `delta` steps away (1 = next, -1 = previous), or null at either end. */
  function neighbor(delta: 1 | -1) {
    if (!source.value || index.value < 0) return null
    return source.value.identifiers[index.value + delta] ?? null
  }

  /** Moves the context to the neighbor and returns it, for the caller to navigate to. */
  function step(delta: 1 | -1) {
    const next = neighbor(delta)
    if (next) current.value = next
    return next
  }

  return { source, current, open, clear, enter, refresh, position, neighbor, step }
})
