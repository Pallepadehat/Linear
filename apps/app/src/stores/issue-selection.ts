import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  retainSelection,
  selectRange,
  toggleGroupSelection,
  toggleSelection,
} from '@/features/issues/selection'

/**
 * The issues selected for bulk actions on the current list or board (UI state
 * only; the issues themselves stay in the query cache). `anchorId` is where a
 * shift-click range starts.
 */
export const useIssueSelectionStore = defineStore('issue-selection', () => {
  const selectedIds = ref<ReadonlySet<string>>(new Set())
  const anchorId = ref<string | null>(null)
  const count = computed(() => selectedIds.value.size)

  function toggle(id: string) {
    selectedIds.value = toggleSelection(selectedIds.value, id)
    anchorId.value = id
  }
  /** Shift-click / shift+X: the range from the anchor to `id`, in `order`. */
  function extendTo(order: readonly string[], id: string) {
    selectedIds.value = selectRange(order, anchorId.value, id, selectedIds.value)
    anchorId.value = id
  }
  function toggleGroup(ids: readonly string[]) {
    selectedIds.value = toggleGroupSelection(selectedIds.value, ids)
  }
  function retain(listed: ReadonlySet<string>) {
    selectedIds.value = retainSelection(selectedIds.value, listed)
    if (anchorId.value && !listed.has(anchorId.value)) anchorId.value = null
  }
  function clear() {
    if (selectedIds.value.size) selectedIds.value = new Set()
    anchorId.value = null
  }

  return { selectedIds, anchorId, count, toggle, extendTo, toggleGroup, retain, clear }
})
