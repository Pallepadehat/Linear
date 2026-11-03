import type { IssueTemplate } from '@linear/contract'
import type { TemplateRecord } from '@linear/core'

export function toTemplateDto(row: TemplateRecord): IssueTemplate {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    title: row.title,
    description: row.description,
    statusId: row.statusId,
    statusCategory: row.statusCategory,
    priority: row.priority,
    assigneeId: row.assigneeId,
    projectId: row.projectId,
    labelIds: row.labelIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
