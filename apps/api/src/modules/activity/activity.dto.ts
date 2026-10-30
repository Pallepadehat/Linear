import type { Activity } from '@linear/contract'
import type { ActivityRecord } from '@linear/core'

export function toActivityDto(record: ActivityRecord): Activity {
  return {
    id: record.id,
    issueId: record.issueId,
    actorType: record.actorType,
    actorId: record.actorId,
    kind: record.kind,
    from: record.from,
    to: record.to,
    createdAt: record.createdAt,
  }
}
