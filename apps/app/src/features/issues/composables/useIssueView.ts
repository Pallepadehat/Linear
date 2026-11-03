import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEFAULT_ISSUE_VIEW, parseIssueView, type IssueView } from '../issue-view'

/**
 * The Active / Backlog / All issues tab, kept in `?view=` next to the filter
 * params (which it leaves as they are). Switching tabs pushes a history entry
 * so back/forward walks through them; All issues is the default and stays out of the URL.
 */
export function useIssueView() {
  const route = useRoute()
  const router = useRouter()
  const view = computed(() => parseIssueView(route.query))

  function select(next: IssueView) {
    if (next === view.value) return
    void router.push({
      query: { ...route.query, view: next === DEFAULT_ISSUE_VIEW ? undefined : next },
    })
  }

  return { view, select }
}
