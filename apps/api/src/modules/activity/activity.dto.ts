import type { Activity } from '@linear/contract'
import type { ActivityEntry } from '@linear/core'

export function toActivityDto(record: ActivityEntry): Activity {
  return {
    id: record.id,
    issueId: record.issueId,
    actorType: record.actorType,
    actorId: record.actorId,
    pullRequestId: record.pullRequestId,
    kind: record.kind,
    from: record.from,
    to: record.to,
    mentionedIn: record.mentionedIn,
    createdAt: record.createdAt,
  }
}
