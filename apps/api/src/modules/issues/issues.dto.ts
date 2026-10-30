import type { Issue } from '@linear/contract'
import type { IssueRecord } from '@linear/core'
import { toLabelDto } from '../labels/labels.dto'

export function toIssueDto(record: IssueRecord): Issue {
  return {
    id: record.id,
    identifier: record.identifier,
    number: record.number,
    teamId: record.teamId,
    title: record.title,
    description: record.description,
    status: {
      id: record.status.id,
      name: record.status.name,
      category: record.status.category,
      position: record.status.position,
    },
    priority: record.priority,
    assigneeId: record.assigneeId,
    creatorId: record.creatorId,
    projectId: record.projectId,
    labels: record.labels.map(toLabelDto),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  }
}
