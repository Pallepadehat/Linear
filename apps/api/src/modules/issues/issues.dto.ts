import type { Issue, IssueDetail } from '@linear/contract'
import type { IssueDetailRecord, IssueRecord, IssueRelationsRecord } from '@linear/core'
import { toLabelDto } from '../labels/labels.dto'
import { toIssueRelationsDto } from '../relations/relations.dto'

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
    milestoneId: record.milestoneId,
    cycleId: record.cycleId,
    estimate: record.estimate,
    dueDate: record.dueDate,
    labels: record.labels.map(toLabelDto),
    isSubscribed: record.isSubscribed,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    blockedByCount: record.blockedByCount,
    blockingCount: record.blockingCount,
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

export function toIssueDetailDto(
  record: IssueDetailRecord,
  relations: IssueRelationsRecord,
): IssueDetail {
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
    relations: toIssueRelationsDto(relations),
  }
}
