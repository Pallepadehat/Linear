import type { PresenceEntry } from '@linear/contract'
import { timeAgo } from '@/lib/relative-time'

export type PresenceStatus = PresenceEntry['state']

export const HEARTBEAT_MS = 20_000

/** Other members viewing `issueId` right now, active ones first; you are excluded. */
export function viewersOf(entries: PresenceEntry[], issueId: string, meId: string | undefined) {
  return entries
    .filter((e) => e.viewingIssueId === issueId && e.userId !== meId && e.state !== 'offline')
    .sort((a, b) => Number(b.state === 'active') - Number(a.state === 'active'))
}

/** "Online", "Away", "Last seen 5 minutes ago", or "Offline" when never seen. */
export function presenceLabel(entry: PresenceEntry | undefined, now = new Date()) {
  if (entry?.state === 'active') return 'Online'
  if (entry?.state === 'away') return 'Away'
  if (entry?.lastSeenAt) return `Last seen ${timeAgo(entry.lastSeenAt, now)}`
  return 'Offline'
}
