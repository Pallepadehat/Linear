import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  nextFilterQuery,
  parseIssueFilters,
  type IssueFilters,
} from '../issue-filters'

/**
 * Issue list filters, stored in the route query so a reload or a
 * shared link opens the same view. Updates replace the history entry instead
 * of pushing one per keystroke or checkbox.
 */
export function useIssueFilters() {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => parseIssueFilters(route.query))
  const active = computed(() => hasActiveFilters(filters.value))

  function update(changes: Partial<IssueFilters>) {
    void router.replace({ query: nextFilterQuery(route.query, filters.value, changes) })
  }

  /** Clears filters and search; display options (a per-view preference) stay. */
  function clear() {
    update(EMPTY_FILTERS)
  }

  return { filters, active, update, clear }
}
