import { projectActivitySchema, type ProjectActivity } from '@linear/contract'
import type { ProjectActivityRecord } from '@linear/core'

/**
 * `kind` and `payload` are separate columns, so the contract schema ties them back
 * together (and rejects a payload that doesn't match its kind).
 */
export function toProjectActivityDto(
  record: ProjectActivityRecord,
  avatarUrl: string | null,
): ProjectActivity {
  return projectActivitySchema.parse({
    id: record.id,
    projectId: record.projectId,
    actorType: record.actorType,
    actor:
      record.actorId && record.actorName !== null
        ? { id: record.actorId, name: record.actorName, avatarUrl }
        : null,
    kind: record.kind,
    payload: record.payload,
    createdAt: record.createdAt,
  })
}
