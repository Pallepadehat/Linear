import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  parseIssueFilters,
  serializeIssueFilters,
  type IssueFilters,
} from '../issue-filters'

const FILTER_KEYS = [
  'status',
  'priority',
  'assignee',
  'project',
  'label',
  'due',
  'q',
  'sort',
  'dir',
]

/**
 * Issue list filters and sort, stored in the route query so a reload or a
 * shared link opens the same view. Updates replace the history entry instead
 * of pushing one per keystroke or checkbox.
 */
export function useIssueFilters() {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => parseIssueFilters(route.query))
  const active = computed(() => hasActiveFilters(filters.value))

  function update(changes: Partial<IssueFilters>) {
    // Keep unrelated query params (owned by other features) as they are.
    const rest = Object.fromEntries(
      Object.entries(route.query).filter(([key]) => !FILTER_KEYS.includes(key)),
    )
    void router.replace({
      query: { ...rest, ...serializeIssueFilters({ ...filters.value, ...changes }) },
    })
  }

  /** Clears filters and search; the sort stays. */
  function clear() {
    const { sort, direction } = filters.value
    update({ ...EMPTY_FILTERS, sort, direction })
  }

  return { filters, active, update, clear }
}
