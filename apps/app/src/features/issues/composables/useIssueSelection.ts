import type { Issue } from '@linear/contract'
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, watch, type Ref } from 'vue'
import { useHotkeys } from '@/composables/useHotkeys'
import { useIssueSelectionStore } from '@/stores/issue-selection'
import { groupSelectionState } from '../selection'

/**
 * Multi-select for a list or board (docs/domain.md → Bulk actions). `issues` is the
 * render order shift-click ranges follow; `loaded` (default `issues`) is everything
 * the view holds, including collapsed groups. The selection drops issues that leave
 * it and is cleared when the view unmounts. `keyboard` binds X (the card
 * holding focus) and Esc for views without their own list keyboard (the board).
 */
export function useIssueSelection(
  issues: Ref<Issue[]>,
  options: { loaded?: Ref<Issue[]>; keyboard?: boolean } = {},
) {
  const selection = useIssueSelectionStore()
  const { selectedIds } = storeToRefs(selection)

  /** Checkbox, ⌘/Ctrl-click: toggle one; shift-click: the range from the last one clicked. */
  function click(issue: Issue, event?: MouseEvent | KeyboardEvent) {
    if (event?.shiftKey)
      selection.extendTo(
        issues.value.map((i) => i.id),
        issue.id,
      )
    else selection.toggle(issue.id)
  }
  const groupState = (group: Issue[]) =>
    groupSelectionState(
      selectedIds.value,
      group.map((issue) => issue.id),
    )
  const toggleGroup = (group: Issue[]) => selection.toggleGroup(group.map((issue) => issue.id))

  watch(options.loaded ?? issues, (list) =>
    selection.retain(new Set(list.map((issue) => issue.id))),
  )
  onBeforeUnmount(() => selection.clear())

  if (options.keyboard) {
    const focusedIssue = () => {
      const id = document.activeElement?.closest<HTMLElement>('[data-issue-id]')?.dataset.issueId
      return issues.value.find((issue) => issue.id === id)
    }
    useHotkeys([
      {
        id: 'list-select',
        run: (event) => {
          const issue = focusedIssue()
          if (!issue) return false
          click(issue, event)
        },
      },
      {
        id: 'list-clear',
        run: () => {
          if (!selection.count) return false
          selection.clear()
        },
      },
    ])
  }

  return { selectedIds, click, groupState, toggleGroup }
}
