import type { ProjectUpdate } from '@linear/contract'
import type { ProjectUpdateRecord } from '@linear/core'

export function toProjectUpdateDto(
  record: ProjectUpdateRecord,
  avatarUrl: string | null,
): ProjectUpdate {
  return {
    id: record.id,
    projectId: record.projectId,
    author: { id: record.authorId, name: record.authorName, avatarUrl },
    health: record.health,
    body: record.body,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
