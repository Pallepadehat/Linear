import type { ContractClient } from '@linear/contract'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import {
  onBeforeUnmount,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
} from 'vue'
import { HEARTBEAT_MS } from './presence'

// The issue this tab shows, set by the issue page. UI state, not server state.
const viewingIssueId = ref<string | null>(null)

/** Marks this tab as viewing `issueId` while the calling component is mounted. */
export function useViewingIssue(issueId: MaybeRefOrGetter<string | null | undefined>) {
  watch(
    () => toValue(issueId) ?? null,
    (id) => (viewingIssueId.value = id),
    { immediate: true },
  )
  onBeforeUnmount(() => (viewingIssueId.value = null))
}

/**
 * Sends presence heartbeats over the realtime socket: every 20 s, when the viewed
 * issue changes, when the tab is hidden or shown, and on (re)connect. Teammates'
 * `presence.changed` events refetch `presence.list` (see realtime-events.ts).
 */
export function usePresence(
  workspaceSlug: MaybeRefOrGetter<string>,
  client: ShallowRef<ContractClient | null> | Ref<ContractClient | null>,
) {
  const visibility = useDocumentVisibility()

  function beat() {
    const slug = toValue(workspaceSlug)
    if (!slug || !client.value) return
    client.value.presence
      .heartbeat({
        workspaceSlug: slug,
        viewingIssueId: viewingIssueId.value,
        state: visibility.value === 'hidden' ? 'away' : 'active',
      })
      // Best effort: the next beat (or reconnect) tries again.
      .catch(() => {})
  }

  watch([client, viewingIssueId, visibility], beat, { immediate: true })
  useIntervalFn(beat, HEARTBEAT_MS)
}
