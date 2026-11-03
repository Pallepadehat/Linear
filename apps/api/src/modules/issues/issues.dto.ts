import type { Issue, IssueDetail } from '@linear/contract'
import type { IssueDetailRecord, IssueRecord } from '@linear/core'
import { toLabelDto } from '../labels/labels.dto'

export function toIssueDto(record: IssueRecord): Issue {
  return {
    id: record.id,
    identifier: record.identifier,
    number: record.number,
    teamId: record.teamId,
    title: record.title,
    description: record.description,
    status: toStatusDto(record.status),
    priority: record.priority,
    assigneeId: record.assigneeId,
    creatorId: record.creatorId,
    projectId: record.projectId,
    dueDate: record.dueDate,
    labels: record.labels.map(toLabelDto),
    isSubscribed: record.isSubscribed,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    parentId: record.parentId,
    subIssueProgress: record.subIssueProgress,
  }
}

const toStatusDto = (status: IssueRecord['status']) => ({
  id: status.id,
  name: status.name,
  category: status.category,
  position: status.position,
})

export function toIssueDetailDto(record: IssueDetailRecord): IssueDetail {
  const { parent } = record
  return {
    ...toIssueDto(record),
    parent: parent
      ? {
          id: parent.id,
          identifier: parent.identifier,
          title: parent.title,
          status: toStatusDto(parent.status),
        }
      : null,
    children: record.children.map(toIssueDto),
  }
}
