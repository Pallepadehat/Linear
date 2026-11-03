import type { Cycle, CycleDetail } from '@linear/contract'
import type { CycleRecord } from '@linear/core'

export function toCycleDto(record: CycleRecord): Cycle {
  return {
    id: record.id,
    teamId: record.teamId,
    number: record.number,
    name: record.name,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    completedAt: record.completedAt,
    progress: record.progress,
  }
}

export function toCycleDetailDto(record: CycleRecord): CycleDetail {
  return {
    ...toCycleDto(record),
    scopeSnapshot: record.scopeSnapshot,
    completedSnapshot: record.completedSnapshot,
  }
}
