import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { realtimeClient } from './useRealtime'

/** A typing state lasts this long without a refresh (senders refresh every `TYPING_SEND_MS`). */
export const TYPING_TTL_MS = 6_000
export const TYPING_SEND_MS = 3_000

/** issueId → userId → when their typing state expires (ms). UI state, never server data. */
export type TypingState = Map<string, Map<string, number>>

export function applyTyping(
  state: TypingState,
  issueId: string,
  userId: string,
  typing: boolean,
  now: number,
): TypingState {
  const next = new Map(state)
  const users = new Map(next.get(issueId))
  if (typing) users.set(userId, now + TYPING_TTL_MS)
  else users.delete(userId)
  if (users.size) next.set(issueId, users)
  else next.delete(issueId)
  return next
}

/** Who is typing on `issueId` right now, in the order they started, minus `exceptUserId`. */
export function typingUserIds(
  state: TypingState,
  issueId: string,
  now: number,
  exceptUserId?: string,
): string[] {
  return [...(state.get(issueId) ?? [])]
    .filter(([userId, expires]) => expires > now && userId !== exceptUserId)
    .map(([userId]) => userId)
}

/** "Ada is typing…", "Ada and Bob are typing…", "Ada and 2 others are typing…". */
export function typingSentence(names: string[]) {
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  return `${names[0]} and ${names.length - 1} others are typing…`
}

const state = ref<TypingState>(new Map())

/** Called by the realtime handler for `comment.typing` (and to clear on `comment.created`). */
export function setTyping(issueId: string, userId: string, typing: boolean) {
  state.value = applyTyping(state.value, issueId, userId, typing, Date.now())
}

/** Teammates typing a comment on the issue, refreshed every second so states expire. */
export function useTypingUsers(
  issueId: MaybeRefOrGetter<string>,
  currentUserId: MaybeRefOrGetter<string | undefined>,
) {
  const now = ref(Date.now())
  useIntervalFn(() => (now.value = Date.now()), 1_000)
  return computed(() =>
    typingUserIds(state.value, toValue(issueId), now.value, toValue(currentUserId)),
  )
}

/**
 * Tells teammates over the realtime socket that you're writing a comment: `ping()` on
 * every edit (sent at most every `TYPING_SEND_MS`), `stop()` when sent, emptied or
 * abandoned. Best effort: nothing is sent while the socket is down.
 */
export function useTypingSignal(
  workspaceSlug: MaybeRefOrGetter<string>,
  issueId: MaybeRefOrGetter<string>,
) {
  let lastSent = 0
  let typing = false

  function send(value: boolean) {
    const client = realtimeClient.value
    if (!client) return
    client.presence
      .typing({ workspaceSlug: toValue(workspaceSlug), issueId: toValue(issueId), typing: value })
      .catch(() => {})
  }

  function ping() {
    const now = Date.now()
    if (typing && now - lastSent < TYPING_SEND_MS) return
    typing = true
    lastSent = now
    send(true)
  }

  function stop() {
    if (!typing) return
    typing = false
    lastSent = 0
    send(false)
  }

  // Moving to another issue (J/K) or leaving the page ends the signal for the old one.
  watch(
    () => toValue(issueId),
    (_id, previous) => {
      if (!typing || !previous) return
      typing = false
      realtimeClient.value?.presence
        .typing({ workspaceSlug: toValue(workspaceSlug), issueId: previous, typing: false })
        .catch(() => {})
    },
  )
  onBeforeUnmount(stop)

  return { ping, stop }
}
