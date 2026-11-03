import type { Issue } from '@linear/contract'
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHotkeys } from '@/composables/useHotkeys'
import { useUiStore } from '@/stores/ui'
import { stepFocus } from '../list-focus'

/**
 * Keyboard navigation for an issue list (list scope): J/K and ↑/↓ move the
 * focused row, Enter opens it, X toggles its selection (bulk actions, M7-12),
 * Esc clears focus and ⌘⌫ asks to delete it. The focused issue is the command
 * menu's context. `issues` is the on-screen order; `reveal` scrolls a row into
 * view (virtualized lists) and focuses it.
 */
export function useIssueListKeyboard(issues: Ref<Issue[]>, reveal: (issue: Issue) => void) {
  const router = useRouter()
  const ui = useUiStore()
  const focusedId = ref<string | null>(null)
  const selectedIds = ref(new Set<string>())

  const focused = () => issues.value.find((issue) => issue.id === focusedId.value)

  function move(delta: 1 | -1) {
    const next = stepFocus(
      issues.value.map((issue) => issue.id),
      focusedId.value,
      delta,
    )
    const issue = issues.value.find((i) => i.id === next)
    if (!issue) return false
    focusedId.value = issue.id
    reveal(issue)
  }

  useHotkeys([
    { id: 'list-next', run: () => move(1) },
    { id: 'list-prev', run: () => move(-1) },
    {
      id: 'list-open',
      run: () => {
        const issue = focused()
        if (!issue) return false
        void router.push({ name: 'issue', params: { identifier: issue.identifier } })
      },
    },
    {
      id: 'list-select',
      run: () => {
        const issue = focused()
        if (!issue) return false
        const next = new Set(selectedIds.value)
        if (!next.delete(issue.id)) next.add(issue.id)
        selectedIds.value = next
      },
    },
    {
      id: 'list-clear',
      run: () => {
        if (!focusedId.value && !selectedIds.value.size) return false
        focusedId.value = null
        selectedIds.value = new Set()
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      },
    },
    {
      id: 'list-delete',
      run: () => {
        const issue = focused()
        if (!issue) return false
        ui.issueToDelete = { id: issue.id, identifier: issue.identifier }
      },
    },
  ])

  // A focused issue that leaves the list (deleted, filtered out) drops focus.
  watch(issues, (list) => {
    if (focusedId.value && !list.some((issue) => issue.id === focusedId.value))
      focusedId.value = null
  })

  watch(focusedId, (id, previous) => {
    const issue = focused()
    if (issue) ui.activeIssue = { id: issue.id, identifier: issue.identifier }
    else if (ui.activeIssue?.id === previous) ui.activeIssue = null
  })
  onBeforeUnmount(() => {
    if (ui.activeIssue && ui.activeIssue.id === focusedId.value) ui.activeIssue = null
  })

  return { focusedId, selectedIds }
}
